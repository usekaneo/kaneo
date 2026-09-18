mod api;
mod cli;
mod config;
mod native_host;
mod queue;
mod sampler;
mod spans;
mod tracker;

use std::sync::Arc;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent, Wry};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use tracker::{Status, Tracker};

const MINIMIZED_FLAG: &str = "--minimized";

pub fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // Decided before anything else starts: a browser launching the native
    // messaging host must not reach the single-instance plugin (which would
    // wake the running tray app) or open a window.
    if native_host::is_invocation(&args) {
        std::process::exit(native_host::run());
    }
    if let Some(code) = cli::run(&args) {
        std::process::exit(code);
    }
    run_app(args.iter().any(|a| a == MINIMIZED_FLAG));
}

#[tauri::command]
fn get_status(tracker: State<'_, Arc<Tracker>>) -> Status {
    tracker.status()
}

#[tauri::command]
async fn connect(app: AppHandle, address: String, code: String) -> Result<Status, String> {
    let tracker = app.state::<Arc<Tracker>>().inner().clone();
    let status = tauri::async_runtime::spawn_blocking(move || tracker.connect(&address, &code))
        .await
        .map_err(|e| e.to_string())??;
    // Tracking only makes sense while paired, so start-at-login follows pairing.
    let _ = app.autolaunch().enable();
    Ok(status)
}

#[tauri::command]
fn set_paused(paused: bool, tracker: State<'_, Arc<Tracker>>) -> Status {
    tracker.set_paused(paused);
    tracker.status()
}

#[tauri::command]
fn disconnect(app: AppHandle, tracker: State<'_, Arc<Tracker>>) -> Status {
    tracker.disconnect();
    let _ = app.autolaunch().disable();
    tracker.status()
}

struct TrayItems {
    status: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
}

fn run_app(start_minimized: bool) {
    let dir = config::data_dir();
    // Lets the Chrome/Edge extension reach this computer's agent (Windows only).
    #[cfg(windows)]
    if let Err(e) = native_host::register(&dir) {
        eprintln!("could not register the browser native messaging host: {e}");
    }
    let tracker = Tracker::new(dir);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_FLAG]),
        ))
        .manage(tracker.clone())
        .invoke_handler(tauri::generate_handler![
            get_status, connect, set_paused, disconnect
        ])
        .setup(move |app| {
            let handle = app.handle();
            let items = TrayItems {
                status: MenuItem::with_id(
                    handle,
                    "status",
                    "Status: starting",
                    false,
                    None::<&str>,
                )?,
                toggle: MenuItem::with_id(handle, "toggle", "Pause tracking", true, None::<&str>)?,
            };
            let menu = Menu::with_items(
                handle,
                &[
                    &items.status,
                    &PredefinedMenuItem::separator(handle)?,
                    &items.toggle,
                    &MenuItem::with_id(handle, "open", "Open Kaneo Agent", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "quit", "Quit Kaneo Agent", true, None::<&str>)?,
                ],
            )?;

            let tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("bundle icon"))
                .tooltip("Kaneo Agent")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        let tracker = app.state::<Arc<Tracker>>();
                        let paused = tracker.status().mode == "paused";
                        tracker.set_paused(!paused);
                    }
                    "open" => show_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let app_handle = handle.clone();
            tracker.on_change(move |status| {
                let label = status.label();
                let _ = tray.set_tooltip(Some(format!("Kaneo Agent: {label}")));
                let _ = items.status.set_text(format!("Status: {label}"));
                let _ = items.toggle.set_enabled(status.mode != "not_connected");
                let _ = items.toggle.set_text(if status.mode == "paused" {
                    "Resume tracking"
                } else {
                    "Pause tracking"
                });
                let _ = tauri::Emitter::emit(&app_handle, "status", status);
            });

            let worker = tracker.clone();
            std::thread::Builder::new()
                .name("tracker".into())
                .spawn(move || worker.run())?;

            if !start_minimized || !tracker.is_connected() {
                show_window(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing hides to the tray; "Quit" in the tray menu exits.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to start Kaneo Agent");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            app.state::<Arc<Tracker>>().shutdown();
        }
    });
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
