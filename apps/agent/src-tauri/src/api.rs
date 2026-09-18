//! Client for the Kaneo device endpoints (`/api/agent/device/*`).

use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::spans::Span;

pub const AGENT_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Server rule: at most 500 spans per upload.
pub const MAX_BATCH: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub track_domains: bool,
    pub heartbeat_seconds: u64,
    pub sync_seconds: u64,
    pub idle_after_seconds: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            track_domains: false,
            heartbeat_seconds: 60,
            sync_seconds: 60,
            idle_after_seconds: 300,
        }
    }
}

impl Settings {
    /// Guards against a misconfigured server turning the agent into a busy loop.
    pub fn clamped(self) -> Self {
        Settings {
            track_domains: self.track_domains,
            heartbeat_seconds: self.heartbeat_seconds.clamp(15, 3_600),
            sync_seconds: self.sync_seconds.clamp(15, 3_600),
            idle_after_seconds: self.idle_after_seconds.clamp(30, 7_200),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paired {
    pub device_id: String,
    pub token: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub user_name: String,
    pub settings: Settings,
}

/// Whether the person is clocked in, as the server sees it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attendance {
    /// The company clocks people in and out from this app.
    #[serde(default)]
    pub auto_clock: bool,
    #[serde(default)]
    pub clocked_in: bool,
    #[serde(default)]
    pub since: Option<String>,
    /// The open session was started by the app rather than by hand.
    #[serde(default)]
    pub automatic: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatReply {
    pub settings: Settings,
    /// Missing from servers without automatic clocking.
    #[serde(default)]
    pub attendance: Option<Attendance>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadReply {
    pub accepted: u64,
    pub duplicates: u64,
}

#[derive(Debug)]
pub enum ApiError {
    /// 401: the device was revoked in Kaneo.
    Unauthorized,
    /// The server answered with a non-2xx status; the body is its plain-text message.
    Status(u16, String),
    /// DNS, TLS, timeout, refused connection: worth retrying later.
    Network(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::Unauthorized => write!(f, "This computer was disconnected in Kaneo."),
            ApiError::Status(code, body) if body.trim().is_empty() => {
                write!(f, "Kaneo answered with status {code}.")
            }
            ApiError::Status(_, body) => write!(f, "{}", body.trim()),
            ApiError::Network(e) => write!(f, "Could not reach Kaneo: {e}"),
        }
    }
}

impl std::error::Error for ApiError {}

/// Accepts the web address or the API address and returns the API base
/// (`<origin>/api`) without doubling a trailing `/api`.
pub fn api_base(input: &str) -> Result<String, String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Enter your Kaneo address.".into());
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let url = reqwest::Url::parse(&with_scheme).map_err(|_| "That address doesn't look right.")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Use an http:// or https:// address.".into());
    }
    let mut base = with_scheme.trim_end_matches('/').to_string();
    if !base.ends_with("/api") {
        base.push_str("/api");
    }
    Ok(base)
}

/// Normalizes a pairing code the way the server does (case-insensitive,
/// dashes and spaces ignored) so length checks match.
pub fn normalize_code(code: &str) -> String {
    code.chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect::<String>()
        .to_uppercase()
}

pub struct Client {
    http: reqwest::blocking::Client,
    base: String,
}

impl Client {
    pub fn new(base: &str) -> Self {
        Self::with_timeout(base, Duration::from_secs(20))
    }

    pub fn with_timeout(base: &str, timeout: Duration) -> Self {
        let http = reqwest::blocking::Client::builder()
            .timeout(timeout)
            .user_agent(format!("KaneoAgent/{AGENT_VERSION}"))
            .build()
            .expect("HTTP client");
        Client {
            http,
            base: base.trim_end_matches('/').to_string(),
        }
    }

    pub fn pair(&self, code: &str, device_name: &str) -> Result<Paired, ApiError> {
        let body = serde_json::json!({
            "code": normalize_code(code),
            "deviceName": device_name,
            "platform": platform(),
            "agentVersion": AGENT_VERSION,
        });
        self.post("/agent/device/pair", None, &body)
    }

    pub fn heartbeat(&self, token: &str, state: &str) -> Result<HeartbeatReply, ApiError> {
        let body = serde_json::json!({ "state": state, "agentVersion": AGENT_VERSION });
        self.post("/agent/device/heartbeat", Some(token), &body)
    }

    /// Tells the server the app is quitting, so automatic clock-out needn't
    /// wait for the device to go quiet.
    pub fn offline(&self, token: &str) -> Result<(), ApiError> {
        self.post::<serde::de::IgnoredAny>(
            "/agent/device/offline",
            Some(token),
            &serde_json::json!({}),
        )
        .map(|_| ())
    }

    pub fn upload(&self, token: &str, spans: &[Span]) -> Result<UploadReply, ApiError> {
        debug_assert!(spans.len() <= MAX_BATCH);
        self.post(
            "/agent/device/activity",
            Some(token),
            &serde_json::json!({ "spans": spans }),
        )
    }

    fn post<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        token: Option<&str>,
        body: &serde_json::Value,
    ) -> Result<T, ApiError> {
        let mut request = self.http.post(format!("{}{path}", self.base)).json(body);
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        let response = request
            .send()
            .map_err(|e| ApiError::Network(e.to_string()))?;
        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED && token.is_some() {
            return Err(ApiError::Unauthorized);
        }
        if !status.is_success() {
            let text = response.text().unwrap_or_default();
            return Err(ApiError::Status(
                status.as_u16(),
                text.chars().take(300).collect(),
            ));
        }
        response
            .json::<T>()
            .map_err(|e| ApiError::Network(format!("unexpected response: {e}")))
    }
}

pub fn platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_accepts_web_or_api_urls() {
        assert_eq!(
            api_base("https://kaneo.example.com").unwrap(),
            "https://kaneo.example.com/api"
        );
        assert_eq!(
            api_base("https://kaneo.example.com/").unwrap(),
            "https://kaneo.example.com/api"
        );
        assert_eq!(
            api_base("https://kaneo.example.com/api").unwrap(),
            "https://kaneo.example.com/api"
        );
        assert_eq!(
            api_base("https://kaneo.example.com/api/").unwrap(),
            "https://kaneo.example.com/api"
        );
        assert_eq!(
            api_base(" http://localhost:5173 ").unwrap(),
            "http://localhost:5173/api"
        );
        assert_eq!(
            api_base("kaneo.example.com").unwrap(),
            "https://kaneo.example.com/api"
        );
        assert_eq!(
            api_base("https://example.com/kaneo").unwrap(),
            "https://example.com/kaneo/api"
        );
        assert!(api_base("").is_err());
        assert!(api_base("ftp://example.com").is_err());
    }

    #[test]
    fn code_normalization_matches_server() {
        assert_eq!(normalize_code(" k7qm-2xpa "), "K7QM2XPA");
        assert_eq!(normalize_code("K7QM 2XPA"), "K7QM2XPA");
    }

    #[test]
    fn settings_parse_and_clamp() {
        let s: Settings = serde_json::from_str(
            r#"{"trackDomains":true,"heartbeatSeconds":1,"syncSeconds":60,"idleAfterSeconds":300}"#,
        )
        .unwrap();
        assert!(s.track_domains);
        assert_eq!(s.clamped().heartbeat_seconds, 15);
    }
}
