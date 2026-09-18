# Kaneo Agent connector (Chrome / Edge)

A Manifest V3 extension that tells the Kaneo Agent on the same Windows computer which **website domain** is open in the active tab. Without it, the agent on Windows records the browser as an application but no domain. macOS does not need it: the agent reads Safari and Chrome there through AppleScript.

## What it shares

Only the hostname of the active tab in the focused, normal (non-incognito) browser window, lowercased and without `www.`: `https://www.github.com/org/repo?tab=1` becomes `github.com`. It sends `null` when the browser loses focus, the tab is not `http`/`https` (for example `chrome://`, `file://`, a PDF from disk) or the focused window is a popup or DevTools.

It never reads or sends page paths, queries, titles, page contents, form data, history or anything from incognito windows (the extension cannot be enabled in incognito).

Nothing leaves the computer from the extension. It only talks to the local agent through Chrome native messaging (host name `app.kaneo.agent`). The agent keeps the latest value in `browser-domain.json` in its app data directory and includes the domain in activity only while the browser is the foreground app, the value is less than 60 seconds old, and the workspace setting **Track website domains** is on.

## Permissions

- `tabs`: needed to read the active tab's URL passively. `activeTab` is not enough because it only grants access after the user clicks the extension, and host permissions (`<all_urls>`) would expose more than needed. Chrome describes `tabs` as "Read your browsing history" because it allows reading tab URLs; the extension only uses the active tab's hostname.
- `nativeMessaging`: to reach the local agent.
- `alarms`: a 30-second heartbeat while a browser window has focus, so the agent knows the domain is still current.

No host permissions, no content scripts, no remote code.

## Install (unpacked)

1. Install and start the Kaneo Agent once. On start it registers the native messaging host for Chrome, Edge and Brave (per user, under `HKCU`).
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this `browser-extension` folder.

The extension ID is always `nbfhnjnfddphajiolonibldnbkhaegdh`, because `manifest.json` carries a fixed public `key`. The agent only accepts connections from that ID. If the agent is not installed, the extension logs one message to its service-worker console and retries with backoff.

## Publishing to a store

The private key that matches `key` is not in this repository. A Chrome Web Store or Edge Add-ons listing gets its own ID; add `chrome-extension://<store id>/` to `allowed_origins` in `manifest_json` (`src-tauri/src/native_host.rs`) before shipping the listed extension, and remove `key` from the uploaded manifest.

## Message format

Each message is `{"type":"domain","domain":"github.com"|null,"browser":"chrome"|"edge","at":"<ISO time>"}`, sent on tab switch, URL change of the active tab, window focus change and every 30 s while focused. Edge is detected by `Edg/` in the user agent. Brave reports as `chrome`. The host replies `{"type":"ack"}` to each accepted message and ignores anything else, including domains that are not plain lowercase hostnames.
