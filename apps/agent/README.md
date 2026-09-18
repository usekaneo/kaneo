# Kaneo Agent

A small desktop app (Tauri v2) that reports which application you are using and whether you are active or idle to your Kaneo workspace. It runs in the tray, starts at login once paired, and always shows its state: **Tracking**, **Paused** or **Not connected**. You can pause and resume from the tray at any time.

## What it collects

Every 5 seconds it samples:

- **Seconds since the last keyboard or mouse input**, used only to decide *active* or *idle* (idle after the workspace's `idleAfterSeconds`, 300 s by default). Windows: `GetLastInputInfo`. macOS: `CGEventSourceSecondsSinceLastEventType`.
- **The name of the foreground application**, such as "Visual Studio Code" or "Google Chrome". Windows reads the executable's product description, falling back to the file name. macOS uses `lsappinfo`.
- **The website domain** in the browser, where supported and only when the workspace enables `trackDomains`. On macOS this works for Safari and Google Chrome through AppleScript. On Windows it works for Chrome, Edge and Brave through the [Kaneo Agent connector](browser-extension/README.md) extension (see below). Only the hostname is kept (`github.com`). The scheme, path, query and fragment are dropped, and so is `www.`.

Samples are merged into spans of at most 5 minutes. Each span has a start, an end, the state, the app and, where enabled, the domain.

## What it never collects

It never collects keystrokes or key contents, the clipboard, screenshots or screen contents, window titles, page titles, URL paths or queries, form data, or files.

## Website domains on Windows

Windows offers no supported way to read a browser's address bar, so domains come from a small browser extension in [`browser-extension/`](browser-extension/README.md). It sends only the active tab's hostname to the agent over Chrome native messaging; nothing goes to the network from the extension.

- On every normal start the agent writes the host manifest to `%APPDATA%\app.kaneo.agent\native-messaging\app.kaneo.agent.json` and points these per-user registry keys at it (only rewritten when something changed):
  `HKCU\Software\Google\Chrome\NativeMessagingHosts\app.kaneo.agent`,
  `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\app.kaneo.agent`,
  `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\app.kaneo.agent`.
- The browser starts `kaneo-agent.exe` itself with the extension's origin (`chrome-extension://<id>/`) as the first argument. In that mode the agent decides before anything else starts: no window, no tray, no single-instance hand-off to the running agent, no tracker. It reads length-prefixed JSON messages from stdin, accepts only `{type:"domain", domain, browser}` with a plain lowercase hostname or `null`, replies `{type:"ack"}`, and writes `browser-domain.json` (`{domain, browser, updatedAt}`) atomically into the app data directory. It exits when the browser closes the connection. Release builds are GUI-subsystem programs; Chrome and Edge launch hosts through `cmd /c` with redirected pipes, which works for them without a console window.
- While sampling, if the foreground app is `chrome.exe`, `msedge.exe` or `brave.exe`, the agent uses the stored domain only when it is less than 60 s old and came from the same browser (Brave reports as Chrome). Otherwise the sample has no domain. `trackDomains` still decides whether any domain is recorded.
- Only connections from the extension ID `nbfhnjnfddphajiolonibldnbkhaegdh` are allowed. The host reads the default app data directory, so `KANEO_AGENT_DATA_DIR` does not apply to browser-launched hosts.
- Uninstalling the agent does not remove the registry keys yet. They are harmless without the executable; delete them with `reg delete "<key>" /f`.

## Pairing

In Kaneo, open **Settings → Account → Devices** and create a one-time code. Then enter your Kaneo address and the code in the agent. The address can be the web address or the API address. The agent calls `<address>/api`, and an address that already ends in `/api` is used unchanged.

The agent never asks for your password or admin credentials. Pairing returns a device token, which is stored in the OS keychain: Windows Credential Manager or the macOS Keychain. If the keychain is unavailable, the token goes to a file in the app data directory instead.

"Disconnect this computer" removes the token and unsent activity from this computer. An admin or the user can also revoke the device in Kaneo. The agent's next request then gets `401`, and the agent clears its token and returns to **Not connected**.

## Sync

- Closed spans go to a persistent queue (`queue.jsonl` in the app data directory, capped at 50,000 spans, oldest dropped first).
- The agent uploads every `syncSeconds` (60 s by default) in batches of up to 500. A failed upload stays queued and is retried later. The server dedupes by span id, so a retry is safe.
- When there is nothing to upload, the agent sends a heartbeat. While paused it stops sampling and sends a `paused` heartbeat every `heartbeatSeconds`.
- A gap of more than 30 s between samples, such as sleep or a locked machine, ends the current span at the last sample. Time across the gap is not counted.
- Settings returned by the server on pairing and on each heartbeat always win.

App data directory: `%APPDATA%\app.kaneo.agent` on Windows and `~/Library/Application Support/app.kaneo.agent` on macOS.

## Build

Requirements: Rust (stable), plus on Windows the MSVC build tools and WebView2 (already part of Windows 11). The Tauri CLI runs through `npx`. This folder has no `package.json` and stays outside the pnpm workspace on purpose.

```bash
cd apps/agent
npx @tauri-apps/cli@2 dev      # run with a console for logs
npx @tauri-apps/cli@2 build    # release bundles (Windows: NSIS + MSI; macOS: .app + .dmg)
cd src-tauri && cargo test     # unit tests
```

### Debug CLI

The binary takes a few flags that run the same code paths without a window. Set `KANEO_AGENT_DATA_DIR` to keep a test pairing separate from the real one.

```bash
kaneo-agent --pair http://localhost:1337 K7QM-2XPA
kaneo-agent --once 30     # sample for 30 s, then upload
kaneo-agent --sync        # upload the queue or send a heartbeat
kaneo-agent --status
kaneo-agent --disconnect
kaneo-agent --register-native-host   # Windows: write the browser host manifest and registry keys
```

## macOS notes

- No Accessibility or Screen Recording permission is needed.
- Reading the browser domain needs the **Automation** permission. macOS asks once per browser ("Kaneo Agent wants to control Safari/Google Chrome"). If you decline, domains are simply not reported.
- Code signing and notarization are not set up. Unsigned builds must be opened with right-click → Open the first time.

## Known limitations

- Windows: website domains need the browser extension, which is loaded unpacked for now (not in a store). Firefox is not supported.
- Linux: pairing and heartbeats work, but no activity is sampled yet.
- UWP and Store apps on Windows can appear as "Application Frame Host".
