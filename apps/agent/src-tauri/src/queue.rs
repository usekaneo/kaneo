//! Closed spans waiting for upload, persisted as JSON lines so nothing is lost
//! while offline or across restarts.

use std::collections::VecDeque;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

use crate::spans::Span;

pub const DEFAULT_CAP: usize = 50_000;

pub struct Queue {
    path: PathBuf,
    cap: usize,
    items: VecDeque<Span>,
}

impl Queue {
    /// Loads the queue file; unreadable lines are skipped rather than blocking uploads.
    pub fn open(path: PathBuf, cap: usize) -> Self {
        let mut items = VecDeque::new();
        if let Ok(file) = File::open(&path) {
            for line in BufReader::new(file).lines().map_while(Result::ok) {
                if let Ok(span) = serde_json::from_str::<Span>(&line) {
                    items.push_back(span);
                }
            }
        }
        let mut queue = Queue { path, cap, items };
        if queue.items.len() > cap {
            queue.trim();
            let _ = queue.rewrite();
        }
        queue
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn push(&mut self, span: Span) -> std::io::Result<()> {
        self.items.push_back(span);
        if self.items.len() > self.cap {
            self.trim();
            return self.rewrite();
        }
        let line = serde_json::to_string(self.items.back().expect("just pushed"))?;
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        writeln!(file, "{line}")
    }

    /// The oldest spans, up to `max`.
    pub fn front(&self, max: usize) -> Vec<Span> {
        self.items.iter().take(max).cloned().collect()
    }

    /// Removes the `count` oldest spans after they were delivered.
    pub fn drop_front(&mut self, count: usize) -> std::io::Result<()> {
        let count = count.min(self.items.len());
        self.items.drain(..count);
        self.rewrite()
    }

    pub fn clear(&mut self) -> std::io::Result<()> {
        self.items.clear();
        match fs::remove_file(&self.path) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e),
            _ => Ok(()),
        }
    }

    fn trim(&mut self) {
        let excess = self.items.len().saturating_sub(self.cap);
        self.items.drain(..excess);
    }

    /// Writes to a temp file and renames so a crash never leaves a half-written queue.
    fn rewrite(&self) -> std::io::Result<()> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }
        let tmp = self.path.with_extension("tmp");
        {
            let mut file = File::create(&tmp)?;
            for span in &self.items {
                writeln!(file, "{}", serde_json::to_string(span)?)?;
            }
            file.sync_all()?;
        }
        fs::rename(&tmp, &self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spans::State;
    use chrono::{DateTime, Duration};

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("kaneo-agent-test-{}", uuid::Uuid::new_v4()));
        dir.join(name)
    }

    fn span(n: i64) -> Span {
        let start = DateTime::from_timestamp(1_790_000_000 + n * 60, 0).unwrap();
        Span {
            id: format!("span-{n:08}"),
            start,
            end: start + Duration::seconds(30),
            state: State::Active,
            app: Some("Code".into()),
            domain: None,
        }
    }

    #[test]
    fn survives_reopen_and_removes_delivered() {
        let path = temp_path("queue.jsonl");
        let mut q = Queue::open(path.clone(), 100);
        for n in 0..5 {
            q.push(span(n)).unwrap();
        }
        let reopened = Queue::open(path.clone(), 100);
        assert_eq!(reopened.len(), 5);
        assert_eq!(reopened.front(2), vec![span(0), span(1)]);

        let mut q = reopened;
        q.drop_front(2).unwrap();
        let reopened = Queue::open(path.clone(), 100);
        assert_eq!(reopened.front(10), (2..5).map(span).collect::<Vec<_>>());
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn cap_drops_oldest() {
        let path = temp_path("queue.jsonl");
        let mut q = Queue::open(path.clone(), 3);
        for n in 0..5 {
            q.push(span(n)).unwrap();
        }
        assert_eq!(q.front(10), vec![span(2), span(3), span(4)]);
        assert_eq!(Queue::open(path.clone(), 3).len(), 3);
        assert_eq!(
            Queue::open(path.clone(), 2).front(10),
            vec![span(3), span(4)]
        );
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn corrupt_lines_are_skipped_and_clear_removes_file() {
        let path = temp_path("queue.jsonl");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let good = serde_json::to_string(&span(1)).unwrap();
        fs::write(&path, format!("not json\n{good}\n{{\"id\":1}}\n")).unwrap();
        let mut q = Queue::open(path.clone(), 10);
        assert_eq!(q.front(10), vec![span(1)]);
        q.clear().unwrap();
        assert!(!path.exists());
        assert_eq!(Queue::open(path.clone(), 10).len(), 0);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}
