//! Reads the three things the agent is allowed to know: how long since the last
//! input, which application is in front, and the active browser tab's hostname
//! (macOS via AppleScript; Windows via the browser extension, see
//! `native_host`).
//!
//! Privacy rule: never read keystrokes, key contents, the clipboard, the screen,
//! window titles, page titles, URL paths or queries, form data or files.

use std::path::Path;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(windows, target_os = "macos")))]
mod other;
#[cfg(windows)]
mod windows;

#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(not(any(windows, target_os = "macos")))]
use other as platform;
#[cfg(windows)]
use windows as platform;

pub struct Observation {
    /// `None` when the platform cannot tell; the sample is then skipped rather
    /// than guessed.
    pub idle_seconds: Option<u64>,
    pub app: Option<String>,
    pub domain: Option<String>,
}

/// `dir` is the app data directory, where the Windows native messaging host
/// leaves the browser extension's latest report.
pub fn observe(track_domains: bool, dir: &Path) -> Observation {
    #[cfg(windows)]
    let (app, domain) = match platform::foreground() {
        Some(foreground) => {
            let domain = if track_domains {
                crate::native_host::current_domain(dir, &foreground.exe_stem, chrono::Utc::now())
            } else {
                None
            };
            (Some(foreground.name), domain)
        }
        None => (None, None),
    };
    #[cfg(not(windows))]
    let (app, domain) = {
        let _ = dir;
        let app = platform::foreground_app();
        let domain = match (&app, track_domains) {
            (Some(app), true) => platform::browser_url(app).and_then(|url| hostname_from_url(&url)),
            _ => None,
        };
        (app, domain)
    };
    Observation {
        idle_seconds: platform::idle_seconds(),
        app,
        domain,
    }
}

/// Keeps only the hostname of a URL: no scheme, credentials, port, path, query
/// or fragment, and no leading "www.". Returns `None` for anything that is not
/// a plain web hostname (e.g. `file://`, `about:blank`, `chrome://`).
#[cfg_attr(windows, allow(dead_code))]
pub fn hostname_from_url(url: &str) -> Option<String> {
    let (scheme, rest) = url.trim().split_once("://")?;
    if !scheme.eq_ignore_ascii_case("http") && !scheme.eq_ignore_ascii_case("https") {
        return None;
    }
    let authority = rest.split(['/', '?', '#']).next()?;
    let host_port = authority.rsplit('@').next()?;
    if host_port.starts_with('[') {
        return None; // IPv6 literal; not a domain worth reporting
    }
    let host = host_port
        .split(':')
        .next()?
        .trim_end_matches('.')
        .to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_string();
    crate::spans::is_hostname(&host).then_some(host)
}

/// "chrome" -> "Chrome"; used when an executable carries no product name.
pub fn prettify_stem(stem: &str) -> String {
    let mut chars = stem.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_is_reduced_to_hostname() {
        let cases = [
            (
                "https://www.github.com/org/repo?tab=1#x",
                Some("github.com"),
            ),
            (
                "http://user:pw@Docs.Example.com:8080/path",
                Some("docs.example.com"),
            ),
            ("https://example.com", Some("example.com")),
            ("https://example.com.?q=secret", Some("example.com")),
            ("https://localhost:5173/dashboard", Some("localhost")),
            ("file:///C:/Users/me/secret.txt", None),
            ("chrome://settings", None),
            ("about:blank", None),
            ("https://[::1]:8080/", None),
            ("https://bad_host.com/", None),
            ("", None),
        ];
        for (url, want) in cases {
            assert_eq!(hostname_from_url(url).as_deref(), want, "{url}");
        }
    }

    #[test]
    fn stem_is_capitalized() {
        assert_eq!(prettify_stem("chrome"), "Chrome");
        assert_eq!(prettify_stem("Code"), "Code");
        assert_eq!(prettify_stem(""), "");
    }
}
