//! Pairing state: non-secret details in `config.json` under the app data dir,
//! the device token in the OS keychain.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::api::Settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub api_base: String,
    pub device_id: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub user_name: String,
    pub settings: Settings,
}

/// `KANEO_AGENT_DATA_DIR` overrides the location (used by the debug CLI and tests).
pub fn data_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("KANEO_AGENT_DATA_DIR") {
        return PathBuf::from(dir);
    }
    dirs::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("app.kaneo.agent")
}

pub fn queue_path(dir: &Path) -> PathBuf {
    dir.join("queue.jsonl")
}

pub fn load(dir: &Path) -> Option<Config> {
    let text = fs::read_to_string(dir.join("config.json")).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn save(dir: &Path, config: &Config) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    fs::write(dir.join("config.json"), serde_json::to_vec_pretty(config)?)
}

pub fn remove(dir: &Path) {
    let _ = fs::remove_file(dir.join("config.json"));
}

/// Stores the device token in the OS keychain (Windows Credential Manager,
/// macOS Keychain). Only if the keychain is unavailable does it fall back to a
/// file in the app data dir; the token grants device-level access only
/// (reporting activity for this computer), never the user's account.
pub fn store_token(dir: &Path, device_id: &str, token: &str) -> Result<(), String> {
    match keychain::store(device_id, token) {
        Ok(()) => {
            token_file::delete(dir);
            Ok(())
        }
        Err(_) => token_file::store(dir, token),
    }
}

pub fn read_token(dir: &Path, device_id: &str) -> Option<String> {
    keychain::read(device_id).or_else(|| token_file::read(dir))
}

pub fn delete_token(dir: &Path, device_id: &str) {
    keychain::delete(device_id);
    token_file::delete(dir);
}

/// Keyed by device id so separate data dirs never share a token.
#[cfg(any(windows, target_os = "macos"))]
mod keychain {
    const KEYRING_SERVICE: &str = "app.kaneo.agent";

    fn entry(device_id: &str) -> keyring::Result<keyring::Entry> {
        keyring::Entry::new(KEYRING_SERVICE, device_id)
    }

    pub fn store(device_id: &str, token: &str) -> Result<(), String> {
        entry(device_id)
            .and_then(|e| e.set_password(token))
            .map_err(|e| e.to_string())
    }

    pub fn read(device_id: &str) -> Option<String> {
        entry(device_id).and_then(|e| e.get_password()).ok()
    }

    pub fn delete(device_id: &str) {
        let _ = entry(device_id).and_then(|e| e.delete_credential());
    }
}

/// No keychain backend is bundled for Linux; the file fallback is used there.
#[cfg(not(any(windows, target_os = "macos")))]
mod keychain {
    pub fn store(_device_id: &str, _token: &str) -> Result<(), String> {
        Err("no keychain".into())
    }
    pub fn read(_device_id: &str) -> Option<String> {
        None
    }
    pub fn delete(_device_id: &str) {}
}

mod token_file {
    use std::fs;
    use std::path::{Path, PathBuf};

    fn path(dir: &Path) -> PathBuf {
        dir.join("device-token")
    }

    pub fn store(dir: &Path, token: &str) -> Result<(), String> {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        fs::write(path(dir), token).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(path(dir), fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }

    pub fn read(dir: &Path) -> Option<String> {
        let token = fs::read_to_string(path(dir)).ok()?;
        Some(token.trim().to_string()).filter(|t| !t.is_empty())
    }

    pub fn delete(dir: &Path) {
        let _ = fs::remove_file(path(dir));
    }
}
