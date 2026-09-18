//! Chrome/Edge native messaging host for the "Kaneo Agent connector" extension.
//!
//! The browser starts the host with the caller origin as an argument
//! (`chrome-extension://<id>/`, plus `--parent-window=<hwnd>` on Windows) and
//! talks to it over stdin/stdout: each frame is a 4-byte little-endian length
//! followed by UTF-8 JSON. The host only accepts `{type:"domain", domain,
//! browser}` and stores the latest one in `browser-domain.json` in the app data
//! directory, where the tracker picks it up. stdout is the protocol, so nothing
//! else may ever be printed in this mode.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, SubsecRound, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config;

pub const HOST_NAME: &str = "app.kaneo.agent";
/// Fixed by the public `key` in `browser-extension/manifest.json`. A Chrome Web
/// Store listing gets a different ID, which must be added to `allowed_origins`.
pub const EXTENSION_ID: &str = "nbfhnjnfddphajiolonibldnbkhaegdh";
/// Chrome caps host-to-browser messages at 1 MB; ours are tiny, so the same cap
/// applies to what the host accepts.
pub const MAX_FRAME_BYTES: u32 = 1024 * 1024;
/// A domain older than this is treated as unknown (the extension refreshes it
/// every 30 s while a browser window has focus).
pub const FRESH_FOR_SECONDS: i64 = 60;

const STATE_FILE: &str = "browser-domain.json";
const ACK: &[u8] = br#"{"type":"ack"}"#;

/// Chrome passes the caller origin as the first argument.
pub fn is_invocation(args: &[String]) -> bool {
    args.first()
        .is_some_and(|a| a.starts_with("chrome-extension://"))
}

/// Serves one browser connection until stdin closes.
pub fn run() -> i32 {
    let dir = config::data_dir();
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    loop {
        let frame = match read_frame(&mut input) {
            Ok(Some(frame)) => frame,
            Ok(None) | Err(_) => return 0,
        };
        let Frame::Message(bytes) = frame else {
            continue;
        };
        let Some(update) = parse_message(&bytes) else {
            continue;
        };
        if apply_update(&dir, update, Utc::now()).is_ok() && write_frame(&mut output, ACK).is_err()
        {
            return 0;
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Frame {
    Message(Vec<u8>),
    /// Longer than `MAX_FRAME_BYTES`; its body was read and discarded so the
    /// stream stays in sync.
    Oversize,
}

/// `Ok(None)` at end of input, including a frame cut short by a closed pipe.
pub fn read_frame(input: &mut impl Read) -> io::Result<Option<Frame>> {
    let mut header = [0u8; 4];
    if !read_full(input, &mut header)? {
        return Ok(None);
    }
    let len = u32::from_le_bytes(header);
    if len > MAX_FRAME_BYTES {
        let skipped = io::copy(&mut input.take(u64::from(len)), &mut io::sink())?;
        return Ok((skipped == u64::from(len)).then_some(Frame::Oversize));
    }
    let mut body = vec![0u8; len as usize];
    if !read_full(input, &mut body)? {
        return Ok(None);
    }
    Ok(Some(Frame::Message(body)))
}

pub fn write_frame(output: &mut impl Write, body: &[u8]) -> io::Result<()> {
    output.write_all(&(body.len() as u32).to_le_bytes())?;
    output.write_all(body)?;
    output.flush()
}

/// Fills `buf`, or returns `false` if the input ends first.
fn read_full(input: &mut impl Read, buf: &mut [u8]) -> io::Result<bool> {
    match input.read_exact(buf) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => Ok(false),
        Err(e) => Err(e),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Browser {
    Chrome,
    Edge,
    Brave,
}

impl Browser {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "chrome" => Some(Browser::Chrome),
            "edge" => Some(Browser::Edge),
            "brave" => Some(Browser::Brave),
            _ => None,
        }
    }

    /// The browser behind a foreground executable, by file stem.
    pub fn from_exe_stem(stem: &str) -> Option<Self> {
        match stem.to_ascii_lowercase().as_str() {
            "chrome" => Some(Browser::Chrome),
            "msedge" => Some(Browser::Edge),
            "brave" => Some(Browser::Brave),
            _ => None,
        }
    }

    /// Whether a report from `reported` describes this browser. Brave cannot
    /// be told apart from Chrome by its user agent, so it reports as Chrome.
    pub fn accepts(self, reported: Browser) -> bool {
        reported == self || (self == Browser::Brave && reported == Browser::Chrome)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Update {
    pub domain: Option<String>,
    pub browser: Browser,
}

/// Accepts only `{type:"domain", domain: hostname|null, browser}`; anything
/// else, including a domain with a scheme, path or uppercase letters, is ignored.
pub fn parse_message(bytes: &[u8]) -> Option<Update> {
    let value: Value = serde_json::from_slice(bytes).ok()?;
    let object = value.as_object()?;
    if object.get("type")?.as_str()? != "domain" {
        return None;
    }
    let domain = match object.get("domain")? {
        Value::Null => None,
        Value::String(domain) if crate::spans::is_hostname(domain) => Some(domain.clone()),
        _ => return None,
    };
    let browser = Browser::parse(object.get("browser")?.as_str()?)?;
    Some(Update { domain, browser })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserDomain {
    pub domain: Option<String>,
    pub browser: Browser,
    pub updated_at: DateTime<Utc>,
}

pub fn state_path(dir: &Path) -> PathBuf {
    dir.join(STATE_FILE)
}

pub fn read_state(dir: &Path) -> Option<BrowserDomain> {
    serde_json::from_slice(&fs::read(state_path(dir)).ok()?).ok()
}

/// Stores the update unless it is a "no domain" from one browser that would
/// clobber another browser's domain: when focus moves from Chrome to Edge,
/// Chrome's blur can arrive after Edge's focus report.
pub fn apply_update(dir: &Path, update: Update, now: DateTime<Utc>) -> io::Result<()> {
    if update.domain.is_none() {
        if let Some(existing) = read_state(dir) {
            if existing.browser != update.browser && existing.domain.is_some() {
                return Ok(());
            }
        }
    }
    let state = BrowserDomain {
        domain: update.domain,
        browser: update.browser,
        updated_at: now.trunc_subsecs(3),
    };
    write_atomically(&state_path(dir), &serde_json::to_vec_pretty(&state)?)
}

/// The domain to record for a foreground browser, if the extension reported
/// one for that browser within the freshness window.
pub fn domain_for(
    state: &BrowserDomain,
    foreground: Browser,
    now: DateTime<Utc>,
) -> Option<String> {
    let age = now - state.updated_at;
    let fresh = age <= Duration::seconds(FRESH_FOR_SECONDS) && age >= Duration::seconds(-5);
    if !fresh || !foreground.accepts(state.browser) {
        return None;
    }
    state
        .domain
        .clone()
        .filter(|d| crate::spans::is_hostname(d))
}

/// Used by the Windows sampler: `exe_stem` is the foreground process's file stem.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn current_domain(dir: &Path, exe_stem: &str, now: DateTime<Utc>) -> Option<String> {
    let foreground = Browser::from_exe_stem(exe_stem)?;
    domain_for(&read_state(dir)?, foreground, now)
}

/// Writes a temporary file next to `path` and renames it over `path`, so
/// readers never see a half-written file.
fn write_atomically(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(dir)?;
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    // Chrome and Edge each run their own host process; keep temp files apart.
    let tmp = dir.join(format!("{name}.{}.tmp", std::process::id()));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// The host manifest Chrome and Edge read to find and authorize the host.
pub fn manifest_json(host_path: &Path) -> String {
    let manifest = serde_json::json!({
        "name": HOST_NAME,
        "description": "Kaneo Agent",
        "path": host_path.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [format!("chrome-extension://{EXTENSION_ID}/")],
    });
    serde_json::to_string_pretty(&manifest).unwrap_or_default()
}

pub fn manifest_path(dir: &Path) -> PathBuf {
    dir.join("native-messaging")
        .join(format!("{HOST_NAME}.json"))
}

/// (required browser key, host key). Brave is only registered when its own
/// key exists, so machines without Brave get no Brave registry entries.
#[cfg(windows)]
const REGISTRY_KEYS: [(Option<&str>, &str); 3] = [
    (
        None,
        r"Software\Google\Chrome\NativeMessagingHosts\app.kaneo.agent",
    ),
    (
        None,
        r"Software\Microsoft\Edge\NativeMessagingHosts\app.kaneo.agent",
    ),
    (
        Some(r"Software\BraveSoftware\Brave-Browser"),
        r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\app.kaneo.agent",
    ),
];

/// Writes the host manifest and points the per-user Chrome, Edge and (when
/// installed) Brave registry keys at it. Only rewrites what changed, so it is cheap on every
/// start. Returns the manifest path.
#[cfg(windows)]
pub fn register(dir: &Path) -> io::Result<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let path = manifest_path(dir);
    // The agent executable is its own host: in release it is a GUI-subsystem
    // program, which still gets the pipes Chrome hands it through `cmd /c`,
    // and cmd waits for it, so no window or console appears.
    let json = manifest_json(&std::env::current_exe()?);
    if fs::read_to_string(&path).ok().as_deref() != Some(json.as_str()) {
        write_atomically(&path, json.as_bytes())?;
    }
    let value = path.to_string_lossy().into_owned();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for (required, key) in REGISTRY_KEYS {
        if required.is_some_and(|required| hkcu.open_subkey(required).is_err()) {
            continue;
        }
        let (key, _) = hkcu.create_subkey(key)?;
        if key.get_value::<String, _>("").ok().as_deref() != Some(value.as_str()) {
            key.set_value("", &value)?;
        }
    }
    Ok(path)
}

/// macOS reads the domain from Safari and Chrome via AppleScript instead.
#[cfg(not(windows))]
pub fn register(_dir: &Path) -> io::Result<PathBuf> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "the browser extension is only used on Windows",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(body: &[u8]) -> Vec<u8> {
        let mut out = (body.len() as u32).to_le_bytes().to_vec();
        out.extend_from_slice(body);
        out
    }

    fn t(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_790_000_000 + seconds, 0).unwrap()
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("kaneo-agent-test-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn frames_are_decoded_in_order() {
        let mut input = frame(b"{\"a\":1}");
        input.extend(frame(b"{}"));
        let mut reader = input.as_slice();
        assert_eq!(
            read_frame(&mut reader).unwrap(),
            Some(Frame::Message(b"{\"a\":1}".to_vec()))
        );
        assert_eq!(
            read_frame(&mut reader).unwrap(),
            Some(Frame::Message(b"{}".to_vec()))
        );
        assert_eq!(read_frame(&mut reader).unwrap(), None);
    }

    #[test]
    fn oversize_frames_are_skipped_without_losing_sync() {
        let mut input = ((MAX_FRAME_BYTES + 1).to_le_bytes()).to_vec();
        input.extend(vec![b'x'; MAX_FRAME_BYTES as usize + 1]);
        input.extend(frame(b"{}"));
        let mut reader = input.as_slice();
        assert_eq!(read_frame(&mut reader).unwrap(), Some(Frame::Oversize));
        assert_eq!(
            read_frame(&mut reader).unwrap(),
            Some(Frame::Message(b"{}".to_vec()))
        );
    }

    #[test]
    fn truncated_input_ends_the_stream() {
        assert_eq!(read_frame(&mut [1u8, 0].as_slice()).unwrap(), None);
        let mut short = 10u32.to_le_bytes().to_vec();
        short.extend(b"abc");
        assert_eq!(read_frame(&mut short.as_slice()).unwrap(), None);
        let mut huge_but_cut = u32::MAX.to_le_bytes().to_vec();
        huge_but_cut.extend(b"abc");
        assert_eq!(read_frame(&mut huge_but_cut.as_slice()).unwrap(), None);
    }

    #[test]
    fn written_frames_round_trip() {
        let mut out = Vec::new();
        write_frame(&mut out, ACK).unwrap();
        assert_eq!(&out[..4], &(ACK.len() as u32).to_le_bytes());
        assert_eq!(
            read_frame(&mut out.as_slice()).unwrap(),
            Some(Frame::Message(ACK.to_vec()))
        );
    }

    #[test]
    fn only_valid_domain_messages_are_accepted() {
        let ok = parse_message(
            br#"{"type":"domain","domain":"github.com","browser":"chrome","at":"2026-09-18T10:00:00Z"}"#,
        );
        assert_eq!(
            ok,
            Some(Update {
                domain: Some("github.com".into()),
                browser: Browser::Chrome
            })
        );
        assert_eq!(
            parse_message(br#"{"type":"domain","domain":null,"browser":"edge"}"#),
            Some(Update {
                domain: None,
                browser: Browser::Edge
            })
        );
        let rejected: [&[u8]; 10] = [
            br#"{"type":"domain","domain":"github.com/org/repo","browser":"chrome"}"#,
            br#"{"type":"domain","domain":"https://github.com","browser":"chrome"}"#,
            br#"{"type":"domain","domain":"GitHub.com","browser":"chrome"}"#,
            br#"{"type":"domain","domain":"","browser":"chrome"}"#,
            br#"{"type":"domain","domain":"github.com","browser":"firefox"}"#,
            br#"{"type":"domain","browser":"chrome"}"#,
            br#"{"type":"url","domain":"github.com","browser":"chrome"}"#,
            br#"{"type":"domain","domain":42,"browser":"chrome"}"#,
            br#"["domain"]"#,
            b"not json",
        ];
        for message in rejected {
            assert_eq!(
                parse_message(message),
                None,
                "{}",
                String::from_utf8_lossy(message)
            );
        }
        let long = format!(
            r#"{{"type":"domain","domain":"{}","browser":"chrome"}}"#,
            "a".repeat(254)
        );
        assert_eq!(parse_message(long.as_bytes()), None);
    }

    #[test]
    fn domains_expire_after_the_freshness_window() {
        let state = BrowserDomain {
            domain: Some("github.com".into()),
            browser: Browser::Chrome,
            updated_at: t(0),
        };
        assert_eq!(
            domain_for(&state, Browser::Chrome, t(0)).as_deref(),
            Some("github.com")
        );
        assert_eq!(
            domain_for(&state, Browser::Chrome, t(60)).as_deref(),
            Some("github.com")
        );
        assert_eq!(domain_for(&state, Browser::Chrome, t(61)), None);
        assert_eq!(domain_for(&state, Browser::Chrome, t(-30)), None);
    }

    #[test]
    fn domains_only_apply_to_the_reporting_browser() {
        let chrome = BrowserDomain {
            domain: Some("github.com".into()),
            browser: Browser::Chrome,
            updated_at: t(0),
        };
        assert_eq!(domain_for(&chrome, Browser::Edge, t(1)), None);
        assert_eq!(
            domain_for(&chrome, Browser::Brave, t(1)).as_deref(),
            Some("github.com")
        );
        let edge = BrowserDomain {
            browser: Browser::Edge,
            ..chrome.clone()
        };
        assert_eq!(domain_for(&edge, Browser::Chrome, t(1)), None);
        assert_eq!(domain_for(&edge, Browser::Brave, t(1)), None);
        assert_eq!(
            domain_for(&edge, Browser::Edge, t(1)).as_deref(),
            Some("github.com")
        );
    }

    #[test]
    fn browsers_are_matched_by_exe_stem() {
        assert_eq!(Browser::from_exe_stem("chrome"), Some(Browser::Chrome));
        assert_eq!(Browser::from_exe_stem("Chrome"), Some(Browser::Chrome));
        assert_eq!(Browser::from_exe_stem("msedge"), Some(Browser::Edge));
        assert_eq!(Browser::from_exe_stem("MSEDGE"), Some(Browser::Edge));
        assert_eq!(Browser::from_exe_stem("brave"), Some(Browser::Brave));
        assert_eq!(Browser::from_exe_stem("firefox"), None);
        assert_eq!(Browser::from_exe_stem("Code"), None);
    }

    #[test]
    fn updates_are_stored_and_read_back() {
        let dir = temp_dir("state");
        let update = |domain: Option<&str>, browser| Update {
            domain: domain.map(String::from),
            browser,
        };
        apply_update(&dir, update(Some("github.com"), Browser::Chrome), t(0)).unwrap();
        assert_eq!(
            current_domain(&dir, "chrome", t(5)).as_deref(),
            Some("github.com")
        );
        assert_eq!(current_domain(&dir, "msedge", t(5)), None);
        assert_eq!(current_domain(&dir, "notepad", t(5)), None);

        // Edge losing focus must not erase the domain Chrome just reported.
        apply_update(&dir, update(None, Browser::Edge), t(6)).unwrap();
        assert_eq!(read_state(&dir).unwrap().browser, Browser::Chrome);

        apply_update(&dir, update(None, Browser::Chrome), t(7)).unwrap();
        assert_eq!(current_domain(&dir, "chrome", t(8)), None);
        let leftovers: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn state_file_has_the_documented_shape() {
        let state = BrowserDomain {
            domain: Some("github.com".into()),
            browser: Browser::Edge,
            updated_at: t(0),
        };
        let json: Value = serde_json::to_value(&state).unwrap();
        assert_eq!(json["domain"], "github.com");
        assert_eq!(json["browser"], "edge");
        assert!(json["updatedAt"].is_string());
    }

    #[test]
    fn manifest_names_the_host_and_the_extension() {
        let path = PathBuf::from(r"C:\Program Files\Kaneo Agent\kaneo-agent.exe");
        let json: Value = serde_json::from_str(&manifest_json(&path)).unwrap();
        assert_eq!(json["name"], "app.kaneo.agent");
        assert_eq!(json["type"], "stdio");
        assert_eq!(json["path"], path.to_string_lossy().as_ref());
        assert_eq!(
            json["allowed_origins"],
            serde_json::json!(["chrome-extension://nbfhnjnfddphajiolonibldnbkhaegdh/"])
        );
        assert_eq!(json.as_object().unwrap().len(), 5);
    }

    #[test]
    fn host_mode_is_detected_from_the_origin_argument() {
        let args = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(is_invocation(&args(&[
            "chrome-extension://nbfhnjnfddphajiolonibldnbkhaegdh/",
            "--parent-window=0"
        ])));
        assert!(!is_invocation(&args(&["--minimized"])));
        assert!(!is_invocation(&args(&[])));
    }
}
