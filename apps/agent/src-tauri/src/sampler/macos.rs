use std::process::Command;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state_id: i32, event_type: u32) -> f64;
}

/// kCGEventSourceStateCombinedSessionState
const COMBINED_SESSION_STATE: i32 = 0;
/// kCGAnyInputEventType
const ANY_INPUT_EVENT: u32 = !0;

pub fn idle_seconds() -> Option<u64> {
    // SAFETY: a pure query with constant arguments. It reports only the time
    // since the last event, never the event itself.
    let seconds =
        unsafe { CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, ANY_INPUT_EVENT) };
    seconds.is_finite().then(|| seconds.max(0.0) as u64)
}

/// Uses `lsappinfo` (part of macOS, needs no extra permission) to read the
/// frontmost application's display name.
pub fn foreground_app() -> Option<String> {
    let front = run("lsappinfo", &["front"])?;
    let asn = front.trim();
    if asn.is_empty() {
        return None;
    }
    // Output looks like: "LSDisplayName"="Google Chrome"
    let info = run("lsappinfo", &["info", "-only", "name", asn])?;
    let name = info.split_once('=')?.1.trim().trim_matches('"').trim();
    (!name.is_empty()).then(|| name.to_string())
}

/// Active tab URL for Safari and Google Chrome via AppleScript. macOS asks the
/// user once to allow "Kaneo Agent" to control each browser (Automation). The
/// caller reduces the URL to its hostname immediately.
pub fn browser_url(app: &str) -> Option<String> {
    let script = match app {
        "Safari" => r#"tell application "Safari" to get URL of front document"#,
        "Google Chrome" => {
            r#"tell application "Google Chrome" to get URL of active tab of front window"#
        }
        _ => return None,
    };
    run("osascript", &["-e", script]).map(|s| s.trim().to_string())
}

fn run(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}
