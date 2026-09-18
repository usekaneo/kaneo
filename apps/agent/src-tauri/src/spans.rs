//! Merges 5-second samples into spans the server accepts.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

/// A span is split once it reaches this length so progress reaches the server
/// regularly even when nothing changes.
const MAX_OPEN: Duration = Duration::minutes(5);
/// A longer gap between samples means the machine slept or the agent stalled;
/// that time is not attributed to anything.
const MAX_GAP: Duration = Duration::seconds(30);
/// Server rule: a span may be at most 15 minutes long.
const SERVER_MAX: Duration = Duration::minutes(15);
const MAX_APP_CHARS: usize = 120;
const MAX_DOMAIN_CHARS: usize = 253;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Active,
    Idle,
}

impl State {
    pub fn as_str(self) -> &'static str {
        match self {
            State::Active => "active",
            State::Idle => "idle",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sample {
    pub at: DateTime<Utc>,
    pub state: State,
    pub app: Option<String>,
    pub domain: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Span {
    pub id: String,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub state: State,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
}

#[derive(Debug)]
struct Open {
    id: String,
    start: DateTime<Utc>,
    last: DateTime<Utc>,
    state: State,
    app: Option<String>,
    domain: Option<String>,
}

impl Open {
    fn begin(sample: Sample) -> Self {
        Open {
            id: uuid::Uuid::new_v4().to_string(),
            start: sample.at,
            last: sample.at,
            state: sample.state,
            app: sample.app,
            domain: sample.domain,
        }
    }

    fn same_activity(&self, sample: &Sample) -> bool {
        self.state == sample.state && self.app == sample.app && self.domain == sample.domain
    }

    fn close(self, end: DateTime<Utc>) -> Option<Span> {
        sanitize(Span {
            id: self.id,
            start: self.start,
            end,
            state: self.state,
            app: self.app,
            domain: self.domain,
        })
    }
}

#[derive(Debug, Default)]
pub struct SpanBuilder {
    open: Option<Open>,
}

impl SpanBuilder {
    /// Adds a sample and returns any span that it closed.
    pub fn push(&mut self, sample: Sample) -> Option<Span> {
        let Some(open) = self.open.take() else {
            self.open = Some(Open::begin(sample));
            return None;
        };

        let gap = sample.at - open.last;
        if gap < Duration::zero() || gap > MAX_GAP {
            // Clock jumped back or the machine slept: end at the last sample
            // we actually observed rather than stretching over the gap.
            let end = open.last;
            self.open = Some(Open::begin(sample));
            return open.close(end);
        }

        if open.same_activity(&sample) && sample.at - open.start < MAX_OPEN {
            self.open = Some(Open {
                last: sample.at,
                ..open
            });
            return None;
        }

        // The previous activity lasted until this sample; spans stay contiguous.
        let end = sample.at;
        self.open = Some(Open::begin(sample));
        open.close(end)
    }

    /// Closes the open span at its last observed sample (pause, quit, disconnect).
    pub fn flush(&mut self) -> Option<Span> {
        let open = self.open.take()?;
        let end = open.last;
        open.close(end)
    }
}

/// Returns the span in the shape the server accepts, or `None` when it would be
/// rejected. One invalid span fails a whole upload, so bad ones are dropped here.
pub fn sanitize(mut span: Span) -> Option<Span> {
    let length = span.end - span.start;
    if length <= Duration::zero() || length > SERVER_MAX {
        return None;
    }
    if span.id.len() < 8 || span.id.len() > 64 {
        return None;
    }
    span.app = span
        .app
        .map(|a| a.trim().chars().take(MAX_APP_CHARS).collect::<String>())
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty());
    span.domain = span.domain.filter(|d| is_hostname(d));
    Some(span)
}

pub fn is_hostname(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_DOMAIN_CHARS
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_790_000_000 + seconds, 0).unwrap()
    }

    fn sample(seconds: i64, app: &str) -> Sample {
        Sample {
            at: t(seconds),
            state: State::Active,
            app: Some(app.to_string()),
            domain: None,
        }
    }

    #[test]
    fn same_activity_merges_until_it_changes() {
        let mut b = SpanBuilder::default();
        for s in (0..=60).step_by(5) {
            assert_eq!(b.push(sample(s, "Code")), None);
        }
        let span = b
            .push(sample(65, "Chrome"))
            .expect("app change closes span");
        assert_eq!((span.start, span.end), (t(0), t(65)));
        assert_eq!(span.app.as_deref(), Some("Code"));
        assert_eq!(b.push(sample(70, "Chrome")), None);
        let next = b.flush().expect("open span");
        assert_eq!(next.end, t(70));
        assert_eq!(next.app.as_deref(), Some("Chrome"));
        assert_eq!(next.start, t(65));
    }

    #[test]
    fn state_change_closes_span() {
        let mut b = SpanBuilder::default();
        b.push(sample(0, "Code"));
        let idle = Sample {
            state: State::Idle,
            ..sample(5, "Code")
        };
        let span = b.push(idle).unwrap();
        assert_eq!(span.state, State::Active);
        assert_eq!(b.flush(), None, "single-sample span has no length");
    }

    #[test]
    fn long_activity_splits_every_five_minutes() {
        let mut b = SpanBuilder::default();
        let mut closed = vec![];
        for s in (0..=900).step_by(5) {
            closed.extend(b.push(sample(s, "Code")));
        }
        assert_eq!(closed.len(), 3);
        for (i, span) in closed.iter().enumerate() {
            assert_eq!(span.start, t(i as i64 * 300));
            assert_eq!(span.end - span.start, Duration::minutes(5));
        }
        assert_ne!(closed[0].id, closed[1].id);
    }

    #[test]
    fn sleep_gap_ends_span_at_last_sample() {
        let mut b = SpanBuilder::default();
        b.push(sample(0, "Code"));
        b.push(sample(5, "Code"));
        b.push(sample(10, "Code"));
        let span = b.push(sample(3_600, "Code")).expect("gap closes span");
        assert_eq!((span.start, span.end), (t(0), t(10)));
        let after = b.push(sample(3_605, "Code"));
        assert_eq!(after, None);
        assert_eq!(b.flush().unwrap().start, t(3_600));
    }

    #[test]
    fn clock_going_backwards_does_not_produce_negative_spans() {
        let mut b = SpanBuilder::default();
        b.push(sample(100, "Code"));
        b.push(sample(105, "Code"));
        let span = b.push(sample(50, "Code")).unwrap();
        assert!(span.end > span.start);
    }

    #[test]
    fn sanitize_enforces_server_rules() {
        let base = Span {
            id: uuid::Uuid::new_v4().to_string(),
            start: t(0),
            end: t(60),
            state: State::Active,
            app: Some(format!("  {}  ", "x".repeat(200))),
            domain: Some("github.com".into()),
        };
        let ok = sanitize(base.clone()).unwrap();
        assert_eq!(ok.app.unwrap().chars().count(), 120);
        assert_eq!(ok.domain.as_deref(), Some("github.com"));

        assert!(sanitize(Span {
            end: t(0),
            ..base.clone()
        })
        .is_none());
        assert!(sanitize(Span {
            end: t(901),
            ..base.clone()
        })
        .is_none());
        assert!(sanitize(Span {
            end: t(900),
            ..base.clone()
        })
        .is_some());
        assert!(sanitize(Span {
            id: "short".into(),
            ..base.clone()
        })
        .is_none());

        let bad_domain = sanitize(Span {
            domain: Some("github.com/org/repo".into()),
            ..base.clone()
        })
        .unwrap();
        assert_eq!(bad_domain.domain, None);
        let blank_app = sanitize(Span {
            app: Some("   ".into()),
            ..base
        })
        .unwrap();
        assert_eq!(blank_app.app, None);
    }

    #[test]
    fn wire_format_matches_server_contract() {
        let span = Span {
            id: "0123456789".into(),
            start: t(0),
            end: t(60),
            state: State::Idle,
            app: None,
            domain: None,
        };
        let json = serde_json::to_value(&span).unwrap();
        assert_eq!(json["state"], "idle");
        assert!(json["start"].as_str().unwrap().ends_with('Z'));
        assert!(json.get("app").is_none());
    }
}
