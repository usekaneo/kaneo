# Kaneo Mobile

The Kaneo app for Android and iOS, built with Expo and React Native. Works with **Kaneo Cloud** (`cloud.kaneo.app`) and **self-hosted** instances.

## Features

- **Sign in** with email and password, a one-time email code, an API key, or **Continue in browser** (device authorization). The browser flow covers GitHub, Google, Discord, OIDC/SSO and anything else the server supports.
- **Workspaces**: switch, create, rename, describe, leave, delete.
- **Members**: list, invite with a role, resend or cancel invitations, change roles, remove. Accept or decline your own invitations.
- **Projects**: list with progress, create, rename, change the key, make public, archive or restore, move to another workspace, delete.
- **Boards**: swipe between columns, or use the list view. Show the backlog and archived tasks. Filter by text, assignee, priority, label or overdue. Long-press a card to move it, change its priority or assignee, or send it to the top or bottom of its column.
- **Columns**: add, rename, reorder, mark as done, delete.
- **Tasks**: create with every field (including custom fields), edit the title, Markdown description (with preview and image upload), status, priority, assignee, start and due dates, and labels (you can create labels inline). Duplicate, move to another project, share, copy the link, delete.
- **Subtasks and relations**: add subtasks, check them off, link related or blocking tasks.
- **Links**: attach URLs; synced integration links are shown read-only.
- **Custom fields**: text, number, date, checkbox, dropdown, multi-select. Define them in project settings.
- **Time tracking**: start/stop a timer, log time manually, edit your entries.
- **Comments and activity**: Markdown comments with @mentions and image attachments; edit and delete your own comments; full activity timeline.
- **My tasks**, **Inbox** (notifications: mark read, mark all read, clear) and the **workspace activity** feed.
- **Search** across tasks, projects and comments.
- **Account**: name, profile photo, password, notification delivery settings (email, ntfy, Gotify, webhook, event types, due-date reminders).
- **Live updates** over Kaneo's WebSockets while the app is open, and **phone notifications** from a background check (Kaneo has no mobile push service). Android runs the check about every 15 minutes; iOS decides when to run it, so it can be less frequent.

### Left out on purpose

These are admin or desktop tasks that don't fit a phone: integration setup (GitHub, GitLab, Gitea, Slack, Discord, Telegram, Mattermost, webhooks) and sync rules, workflow rules, task import/export, calendar feeds, instance administration, custom role editing, per-member project access, billing, API key management, MCP, project icons and backgrounds, and Gantt/calendar views. They are still available on the web.

## Connecting

- **Kaneo Cloud**: tap _Kaneo Cloud_.
- **Self-hosted**: enter the address you open Kaneo at, e.g. `kaneo.example.com` or `http://192.168.1.20:1337`. If your web app and API are on different hosts, enter the **API** address. `http://` is allowed for LAN/VPN servers on both platforms.

_Continue in browser_ uses the device-authorization client `kaneo-cli`, which Kaneo accepts by default. If an instance sets `DEVICE_AUTH_CLIENT_IDS`, it must include `kaneo-cli` for this option to work. Password, email code and API key sign-in work regardless.

On Kaneo Cloud, creating an account and requesting an email code are protected by a browser captcha, so the app opens the website for sign-up; password sign-in and browser sign-in work in the app.

Credentials are stored with `expo-secure-store`: in the iOS Keychain, and encrypted with a key held in the Android Keystore.

## Development

Install dependencies from the repository root with `pnpm install`. The app uses native modules, so run it as a development build rather than in Expo Go:

```bash
pnpm --filter @kaneo/mobile android   # needs JDK 17 and the Android SDK
pnpm --filter @kaneo/mobile ios       # needs macOS, Xcode and CocoaPods
pnpm --filter @kaneo/mobile start     # Metro only, for an already installed development build
```

The `ios/` and `android/` folders are generated from `app.json` and the config plugins in `plugins/` (continuous native generation) and are not committed. Change native settings there, then regenerate with `pnpm --filter @kaneo/mobile exec expo prebuild --clean`.

Checks:

```bash
pnpm --filter @kaneo/mobile lint
pnpm --filter @kaneo/mobile typecheck
pnpm --filter @kaneo/mobile test
```

## Release builds

The **Android APK** workflow (`.github/workflows/android.yml`) builds a release APK and uploads it as a workflow artifact. It runs on pull requests that touch `apps/mobile` and can be started by hand. Bump `version` and `android.versionCode` in `app.json` for each APK you hand out; Android only installs an update with a higher `versionCode`.

Release builds are signed with the key named by `KANEO_ANDROID_KEYSTORE`, `KANEO_ANDROID_KEYSTORE_PASSWORD`, `KANEO_ANDROID_KEY_ALIAS` and `KANEO_ANDROID_KEY_PASSWORD` (see `plugins/with-release-signing.js`), and with the debug key when those are unset. An APK only installs over one signed with the same key, so create the release key once and keep it safe:

```bash
keytool -genkeypair -v -keystore kaneo-release.keystore -alias kaneo \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -i kaneo-release.keystore | pbcopy   # paste into the ANDROID_KEYSTORE_BASE64 secret
```

CI reads the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Locally, export the `KANEO_ANDROID_*` variables and run `pnpm --filter @kaneo/mobile exec expo run:android --variant release`. For iOS, build with `pnpm --filter @kaneo/mobile exec expo run:ios --configuration Release`.

## Project layout

```
src/app/         Expo Router screens; every file is a route
src/components/  shared UI (sheets, pickers, Markdown, avatars, toasts)
src/features/    screen-specific pieces for the home tabs, board and task
src/lib/         API client and types, auth, session storage, realtime, background notifications
src/theme/       Kaneo design tokens, light and dark
plugins/         local Expo config plugins
```
