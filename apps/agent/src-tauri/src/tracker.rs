//! The background loop: sample every 5 s, merge into spans, queue them, and
//! sync with the server on the server-provided interval.

use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use chrono::{DateTime, SubsecRound, Utc};
use serde::Serialize;

use crate::api::{self, ApiError, Attendance, Client, Settings, MAX_BATCH};
use crate::config::{self, Config};
use crate::queue::{self, Queue};
use crate::sampler;
use crate::spans::{self, Sample, SpanBuilder, State};

pub const SAMPLE_EVERY: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// "not_connected" | "tracking" | "paused"
    pub mode: &'static str,
    pub workspace_name: Option<String>,
    pub user_name: Option<String>,
    pub server: Option<String>,
    pub offline: bool,
    pub pending: usize,
    pub last_sync: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub track_domains: bool,
    pub attendance: Option<Attendance>,
}

impl Status {
    pub fn label(&self) -> String {
        match self.mode {
            "not_connected" => "Not connected".into(),
            "paused" => "Paused".into(),
            _ if self.offline => format!("Tracking (offline, {} waiting)", self.pending),
            _ => "Tracking".into(),
        }
    }
}

type Listener = Box<dyn Fn(&Status) + Send + Sync>;

struct Shared {
    config: Option<Config>,
    token: Option<String>,
    paused: bool,
    offline: bool,
    last_sync: Option<DateTime<Utc>>,
    last_error: Option<String>,
    last_state: State,
    builder: SpanBuilder,
    queue: Queue,
    /// Bumped on connect/disconnect so in-flight work for an old device is discarded.
    generation: u64,
    /// Set by pause/resume/connect so the loop reports promptly.
    sync_now: bool,
    attendance: Option<Attendance>,
}

pub struct Tracker {
    dir: PathBuf,
    shared: Mutex<Shared>,
    wake: Condvar,
    listener: Mutex<Option<Listener>>,
    last_notified: Mutex<Option<Status>>,
}

pub struct SyncReport {
    pub uploaded: usize,
    pub accepted: u64,
    pub duplicates: u64,
    pub heartbeat: bool,
}

impl Tracker {
    pub fn new(dir: PathBuf) -> Arc<Self> {
        let config = config::load(&dir);
        let token = config
            .as_ref()
            .and_then(|c| config::read_token(&dir, &c.device_id));
        let queue = Queue::open(config::queue_path(&dir), queue::DEFAULT_CAP);
        Arc::new(Tracker {
            shared: Mutex::new(Shared {
                // Without a token the stored details are useless; treat as unpaired.
                config: config.filter(|_| token.is_some()),
                token,
                paused: false,
                offline: false,
                last_sync: None,
                last_error: None,
                last_state: State::Active,
                builder: SpanBuilder::default(),
                queue,
                generation: 0,
                sync_now: true,
                attendance: None,
            }),
            dir,
            wake: Condvar::new(),
            listener: Mutex::new(None),
            last_notified: Mutex::new(None),
        })
    }

    pub fn on_change(&self, listener: impl Fn(&Status) + Send + Sync + 'static) {
        *self.listener.lock().unwrap() = Some(Box::new(listener));
        *self.last_notified.lock().unwrap() = None;
        self.notify();
    }

    pub fn status(&self) -> Status {
        status_of(&self.lock())
    }

    /// Spans waiting for upload (oldest first); used by the debug CLI.
    pub fn queued(&self, max: usize) -> Vec<spans::Span> {
        self.lock().queue.front(max)
    }

    pub fn is_connected(&self) -> bool {
        self.lock().config.is_some()
    }

    pub fn connect(&self, address: &str, code: &str) -> Result<Status, String> {
        let base = api::api_base(address)?;
        if api::normalize_code(code).len() < 8 {
            return Err("Enter the pairing code shown in Kaneo.".into());
        }
        let paired = Client::new(&base)
            .pair(code, &device_name())
            .map_err(|e| match e {
                ApiError::Status(404, _) => format!(
                    "No Kaneo server answered at {base}. If the API has its own address, enter that instead."
                ),
                e => e.to_string(),
            })?;
        config::store_token(&self.dir, &paired.device_id, &paired.token)
            .map_err(|e| format!("Could not store the device key: {e}"))?;
        let config = Config {
            api_base: base,
            device_id: paired.device_id,
            workspace_id: paired.workspace_id,
            workspace_name: paired.workspace_name,
            user_name: paired.user_name,
            settings: paired.settings.clamped(),
        };
        config::save(&self.dir, &config).map_err(|e| format!("Could not save settings: {e}"))?;
        {
            let mut s = self.lock();
            s.builder = SpanBuilder::default();
            let _ = s.queue.clear();
            s.config = Some(config);
            s.token = Some(paired.token);
            s.paused = false;
            s.offline = false;
            s.last_error = None;
            s.generation += 1;
            s.sync_now = true;
        }
        self.notify();
        Ok(self.status())
    }

    /// Forgets the pairing on this computer. Unsent activity is discarded because
    /// it can no longer be attributed to a device.
    pub fn disconnect(&self) {
        self.forget(None);
    }

    pub fn set_paused(&self, paused: bool) {
        {
            let mut s = self.lock();
            if s.paused == paused {
                return;
            }
            s.paused = paused;
            if paused {
                close_open_span(&mut s);
            }
            s.sync_now = true;
        }
        self.notify();
    }

    /// Persists the open span so it is uploaded after the next start, and
    /// tells the server the app is going away (best effort, briefly: quitting
    /// must not hang on a slow network).
    pub fn shutdown(&self) {
        let target = {
            let mut s = self.lock();
            close_open_span(&mut s);
            match (&s.config, &s.token) {
                (Some(c), Some(t)) => Some((c.api_base.clone(), t.clone())),
                _ => None,
            }
        };
        if let Some((base, token)) = target {
            let _ = Client::with_timeout(&base, Duration::from_secs(3)).offline(&token);
        }
    }

    /// Takes one sample and feeds it to the span builder.
    pub fn sample_once(&self) {
        let track_domains = {
            let s = self.lock();
            match &s.config {
                Some(c) if !s.paused => c.settings.track_domains,
                _ => return,
            }
        };
        let observation = sampler::observe(track_domains, &self.dir);
        let Some(idle) = observation.idle_seconds else {
            return;
        };

        let mut s = self.lock();
        let Some(config) = &s.config else { return };
        if s.paused {
            return;
        }
        let state = if idle >= config.settings.idle_after_seconds {
            State::Idle
        } else {
            State::Active
        };
        let sample = Sample {
            at: Utc::now().trunc_subsecs(3),
            state,
            app: observation.app,
            // The server setting wins even if it changed mid-sample.
            domain: observation.domain.filter(|_| config.settings.track_domains),
        };
        s.last_state = state;
        if let Some(span) = s.builder.push(sample) {
            let _ = s.queue.push(span);
        }
    }

    /// Uploads queued spans in batches, or sends a heartbeat when there is
    /// nothing to upload. Failed uploads stay queued; the server dedupes by
    /// span id so retrying is safe.
    pub fn sync_once(&self) -> Result<SyncReport, ApiError> {
        let mut report = SyncReport {
            uploaded: 0,
            accepted: 0,
            duplicates: 0,
            heartbeat: false,
        };
        let result = self.sync_inner(&mut report);
        {
            let mut s = self.lock();
            match &result {
                Ok(()) => {
                    s.offline = false;
                    s.last_sync = Some(Utc::now().trunc_subsecs(0));
                    s.last_error = None;
                }
                Err(ApiError::Network(e)) => {
                    s.offline = true;
                    s.last_error = Some(format!("Could not reach Kaneo: {e}"));
                }
                Err(ApiError::Unauthorized) => {}
                Err(e) => {
                    s.offline = false;
                    s.last_error = Some(e.to_string());
                }
            }
        }
        if let Err(ApiError::Unauthorized) = result {
            self.forget(Some(
                "This computer was disconnected in Kaneo. Pair it again to resume.".into(),
            ));
        }
        self.notify();
        result.map(|()| report)
    }

    fn sync_inner(&self, report: &mut SyncReport) -> Result<(), ApiError> {
        loop {
            let (client, token, batch, generation) = {
                let s = self.lock();
                let (Some(config), Some(token)) = (&s.config, &s.token) else {
                    return Ok(());
                };
                (
                    Client::new(&config.api_base),
                    token.clone(),
                    s.queue.front(MAX_BATCH),
                    s.generation,
                )
            };

            if batch.is_empty() {
                if report.uploaded == 0 {
                    let state = {
                        let s = self.lock();
                        if s.paused {
                            "paused"
                        } else {
                            s.last_state.as_str()
                        }
                    };
                    let reply = client.heartbeat(&token, state)?;
                    report.heartbeat = true;
                    self.apply_settings(reply.settings, generation);
                    self.apply_attendance(reply.attendance, generation);
                }
                return Ok(());
            }

            // One invalid span fails the whole request, so re-check before sending.
            let valid: Vec<_> = batch.iter().cloned().filter_map(spans::sanitize).collect();
            let outcome = if valid.is_empty() {
                Ok(None)
            } else {
                match client.upload(&token, &valid) {
                    Ok(reply) => Ok(Some(reply)),
                    // The server rejected the batch as malformed; retrying cannot
                    // succeed, so drop it rather than block the queue forever.
                    Err(ApiError::Status(400, body)) => {
                        let mut s = self.lock();
                        s.last_error = Some(format!("Kaneo rejected some activity: {body}"));
                        Ok(None)
                    }
                    Err(e) => Err(e),
                }
            };
            let reply = outcome?;

            let mut s = self.lock();
            if s.generation != generation {
                return Ok(());
            }
            let _ = s.queue.drop_front(batch.len());
            drop(s);
            report.uploaded += valid.len();
            if let Some(reply) = reply {
                report.accepted += reply.accepted;
                report.duplicates += reply.duplicates;
            }
        }
    }

    fn apply_settings(&self, settings: Settings, generation: u64) {
        let mut s = self.lock();
        if s.generation != generation {
            return;
        }
        if let Some(config) = s.config.as_mut() {
            let settings = settings.clamped();
            if config.settings != settings {
                config.settings = settings;
                let _ = config::save(&self.dir, config);
            }
        }
    }

    fn apply_attendance(&self, attendance: Option<Attendance>, generation: u64) {
        {
            let mut s = self.lock();
            if s.generation != generation || s.attendance == attendance {
                return;
            }
            s.attendance = attendance;
        }
        self.notify();
    }

    fn forget(&self, reason: Option<String>) {
        {
            let mut s = self.lock();
            if let Some(config) = s.config.take() {
                config::delete_token(&self.dir, &config.device_id);
            }
            config::remove(&self.dir);
            s.token = None;
            s.builder = SpanBuilder::default();
            let _ = s.queue.clear();
            s.offline = false;
            s.paused = false;
            s.last_sync = None;
            s.last_error = reason;
            s.attendance = None;
            s.generation += 1;
        }
        self.notify();
    }

    /// Runs forever on the calling thread.
    pub fn run(&self) {
        let mut next_sample = Instant::now();
        let mut next_sync = Instant::now();
        loop {
            let now = Instant::now();
            let (connected, paused, sync_every, sync_now) = {
                let mut s = self.lock();
                let sync_now = std::mem::take(&mut s.sync_now);
                let every = s.config.as_ref().map_or(60, |c| {
                    if s.paused {
                        c.settings.heartbeat_seconds
                    } else {
                        c.settings.sync_seconds
                    }
                });
                (s.config.is_some(), s.paused, every, sync_now)
            };

            if connected {
                if !paused && now >= next_sample {
                    self.sample_once();
                    next_sample = now + SAMPLE_EVERY;
                    self.notify();
                }
                if sync_now || now >= next_sync {
                    let _ = self.sync_once();
                    next_sync = Instant::now() + Duration::from_secs(sync_every);
                }
            }

            let until = if connected && !paused {
                next_sample.min(next_sync)
            } else if connected {
                next_sync
            } else {
                Instant::now() + Duration::from_secs(60)
            };
            let wait = until.saturating_duration_since(Instant::now());
            let guard = self.lock();
            if !guard.sync_now {
                let _ = self.wake.wait_timeout(guard, wait);
            }
        }
    }

    fn lock(&self) -> MutexGuard<'_, Shared> {
        self.shared.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Wakes the loop and tells the listener (tray, UI) when the status changed.
    fn notify(&self) {
        self.wake.notify_all();
        let status = self.status();
        let mut last = self.last_notified.lock().unwrap();
        if last.as_ref() == Some(&status) {
            return;
        }
        if let Some(listener) = self.listener.lock().unwrap().as_ref() {
            listener(&status);
        }
        *last = Some(status);
    }
}

fn close_open_span(s: &mut Shared) {
    if let Some(span) = s.builder.flush() {
        let _ = s.queue.push(span);
    }
}

fn status_of(s: &Shared) -> Status {
    let config = s.config.as_ref();
    Status {
        mode: match (config, s.paused) {
            (None, _) => "not_connected",
            (Some(_), true) => "paused",
            (Some(_), false) => "tracking",
        },
        workspace_name: config.map(|c| c.workspace_name.clone()),
        user_name: config.map(|c| c.user_name.clone()),
        server: config.map(|c| c.api_base.trim_end_matches("/api").to_string()),
        offline: s.offline,
        pending: s.queue.len(),
        last_sync: s.last_sync,
        last_error: s.last_error.clone(),
        track_domains: config.is_some_and(|c| c.settings.track_domains),
        attendance: s.attendance.clone(),
    }
}

fn device_name() -> String {
    let name = gethostname::gethostname()
        .to_string_lossy()
        .trim()
        .to_string();
    let name: String = name.chars().take(80).collect();
    if name.is_empty() {
        "Computer".into()
    } else {
        name
    }
}
