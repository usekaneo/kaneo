use std::collections::HashMap;
use std::ffi::c_void;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
};
use windows::Win32::System::SystemInformation::GetTickCount64;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

pub fn idle_seconds() -> Option<u64> {
    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    // SAFETY: `info` is a properly sized, writable LASTINPUTINFO.
    if !unsafe { GetLastInputInfo(&mut info) }.as_bool() {
        return None;
    }
    // dwTime is a 32-bit tick count, so compare in wrapping 32-bit arithmetic.
    let now = unsafe { GetTickCount64() } as u32;
    Some(u64::from(now.wrapping_sub(info.dwTime)) / 1000)
}

pub struct Foreground {
    /// Display name, e.g. "Google Chrome".
    pub name: String,
    /// Executable file stem, e.g. "chrome"; used to recognise browsers.
    pub exe_stem: String,
}

/// The application that owns the foreground window. Only the process image is
/// inspected; the window title is never read.
pub fn foreground() -> Option<Foreground> {
    let path = foreground_exe_path()?;
    let exe_stem = Path::new(&path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    static NAMES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    let cache = NAMES.get_or_init(Default::default);
    if let Some(name) = cache.lock().ok()?.get(&path) {
        return Some(Foreground {
            name: name.clone(),
            exe_stem,
        });
    }
    let name = file_description(&path)
        .or_else(|| Some(super::prettify_stem(&exe_stem)))
        .filter(|n| !n.is_empty())?;
    cache.lock().ok()?.insert(path, name.clone());
    Some(Foreground { name, exe_stem })
}

fn foreground_exe_path() -> Option<String> {
    // SAFETY: plain Win32 queries; every handle opened here is closed below.
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None; // lock screen, secure desktop, or nothing focused
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }
        let process: HANDLE = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(process);
        result.ok()?;
        Some(String::from_utf16_lossy(&buf[..len as usize]))
    }
}

/// The product-facing name from the executable's version resource
/// (e.g. "Visual Studio Code" for Code.exe).
fn file_description(path: &str) -> Option<String> {
    let wide_path = wide(path);
    // SAFETY: buffers are sized by GetFileVersionInfoSizeW and outlive every
    // pointer VerQueryValueW hands back into them.
    unsafe {
        let size = GetFileVersionInfoSizeW(PCWSTR(wide_path.as_ptr()), None);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        GetFileVersionInfoW(
            PCWSTR(wide_path.as_ptr()),
            None,
            size,
            data.as_mut_ptr() as *mut c_void,
        )
        .ok()?;
        let block = data.as_ptr() as *const c_void;

        let mut languages = vec![(0x0409u16, 0x04b0u16)];
        let mut ptr: *mut c_void = std::ptr::null_mut();
        let mut len = 0u32;
        let key = wide("\\VarFileInfo\\Translation");
        if VerQueryValueW(block, PCWSTR(key.as_ptr()), &mut ptr, &mut len).as_bool() && len >= 4 {
            let pairs = std::slice::from_raw_parts(ptr as *const u16, (len / 2) as usize);
            languages = pairs
                .chunks_exact(2)
                .map(|p| (p[0], p[1]))
                .chain(languages)
                .collect();
        }

        for (lang, codepage) in languages {
            let key = wide(&format!(
                "\\StringFileInfo\\{lang:04x}{codepage:04x}\\FileDescription"
            ));
            let mut ptr: *mut c_void = std::ptr::null_mut();
            let mut chars = 0u32;
            if VerQueryValueW(block, PCWSTR(key.as_ptr()), &mut ptr, &mut chars).as_bool()
                && chars > 0
            {
                let text = std::slice::from_raw_parts(ptr as *const u16, chars as usize);
                let text = String::from_utf16_lossy(text);
                let text = text.trim_end_matches('\0').trim();
                if !text.is_empty() {
                    return Some(text.to_string());
                }
            }
        }
        None
    }
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}
