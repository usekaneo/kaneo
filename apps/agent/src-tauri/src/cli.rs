//! Debug commands that exercise the same code paths as the tray app without a
//! window. Set `KANEO_AGENT_DATA_DIR` to keep test pairings apart from the real one.
//!
//!   kaneo-agent --pair <kaneo address> <code>
//!   kaneo-agent --once [seconds]   sample for a while, then upload
//!   kaneo-agent --sync             upload the queue or send a heartbeat
//!   kaneo-agent --status
//!   kaneo-agent --disconnect
//!   kaneo-agent --register-native-host   (Windows) register the browser extension host

use std::time::{Duration, Instant};

use crate::config;
use crate::native_host;
use crate::tracker::{Tracker, SAMPLE_EVERY};

pub fn run(args: &[String]) -> Option<i32> {
    let command = args.first()?.as_str();
    if !matches!(
        command,
        "--pair" | "--once" | "--sync" | "--status" | "--disconnect" | "--register-native-host"
    ) {
        return None;
    }
    attach_console();
    let dir = config::data_dir();
    println!("data dir: {}", dir.display());
    if command == "--register-native-host" {
        return Some(register_native_host(&dir));
    }
    let tracker = Tracker::new(dir);

    let code = match command {
        "--pair" => match (args.get(1), args.get(2)) {
            (Some(address), Some(code)) => match tracker.connect(address, code) {
                Ok(_) => 0,
                Err(e) => {
                    eprintln!("pairing failed: {e}");
                    1
                }
            },
            _ => {
                eprintln!("usage: --pair <kaneo address> <code>");
                2
            }
        },
        "--once" => {
            let seconds = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(30u64);
            let until = Instant::now() + Duration::from_secs(seconds);
            while Instant::now() < until {
                tracker.sample_once();
                std::thread::sleep(SAMPLE_EVERY);
            }
            tracker.sample_once();
            tracker.shutdown();
            for span in tracker.queued(20) {
                println!(
                    "queued: {}",
                    serde_json::to_string(&span).unwrap_or_default()
                );
            }
            sync(&tracker)
        }
        "--sync" => sync(&tracker),
        "--disconnect" => {
            tracker.disconnect();
            0
        }
        _ => 0,
    };
    println!(
        "status: {}",
        serde_json::to_string(&tracker.status()).unwrap_or_default()
    );
    Some(code)
}

fn register_native_host(dir: &std::path::Path) -> i32 {
    match native_host::register(dir) {
        Ok(path) => {
            println!("host manifest: {}", path.display());
            println!("{}", std::fs::read_to_string(&path).unwrap_or_default());
            0
        }
        Err(e) => {
            eprintln!("registration failed: {e}");
            1
        }
    }
}

fn sync(tracker: &Tracker) -> i32 {
    if !tracker.is_connected() {
        eprintln!("not connected");
        return 1;
    }
    match tracker.sync_once() {
        Ok(r) => {
            println!(
                "sync ok: uploaded={} accepted={} duplicates={} heartbeat={}",
                r.uploaded, r.accepted, r.duplicates, r.heartbeat
            );
            0
        }
        Err(e) => {
            eprintln!("sync failed: {e}");
            1
        }
    }
}

/// Release builds use the Windows GUI subsystem; reattach to the launching
/// terminal so debug output is visible.
fn attach_console() {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
        let _ = AttachConsole(ATTACH_PARENT_PROCESS);
    }
}
