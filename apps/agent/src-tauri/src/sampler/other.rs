//! Linux and other platforms: sampling is not implemented yet. Without an idle
//! reading no activity is recorded; the agent still pairs and sends heartbeats.

pub fn idle_seconds() -> Option<u64> {
    None
}

pub fn foreground_app() -> Option<String> {
    None
}

pub fn browser_url(_app: &str) -> Option<String> {
    None
}
