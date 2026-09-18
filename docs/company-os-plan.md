# Company OS plan

Kaneo stays a project tool first. This plan adds a thin company layer (people,
attendance, activity, pay, leave, expenses) around the existing
project → task → time workflow, without redesigning anything.

Guiding rule: if a feature makes routine project work heavier, it is wrong.

## 1. What Kaneo already has (audit)

| Area | Today | Where |
|---|---|---|
| API | Hono + `@hono/zod-openapi`, thin handlers, controllers per feature | `apps/api/src/<feature>/` |
| Auth | Better Auth: email/password, OTP, SSO, API keys, bearer, device flow | `apps/api/src/auth.ts` |
| Workspaces | Better Auth organization plugin (workspace = organization, member = `workspace_member`) | `schema.ts` |
| Roles | `viewer`, `member`, `admin` (editable DB rows per workspace), `owner` (static); custom roles | `packages/permissions`, `workspace_role` |
| Authorization | `workspaceAccess.*` + `requireWorkspacePermission()`; API is the authority | `apps/api/src/utils/` |
| Tasks | projects, columns, tasks, assignee (`task.assignee_id`), labels, comments, activity | `task/`, `activity/` |
| Time | `time_entry` per task; now with start/stop, one running timer per person, timesheet, CSV | `time-entry/` |
| Realtime | `publishEvent()` → WebSocket, optional Redis fan-out | `events/`, `ws/` |
| Scheduler | `croner` jobs (reminders, seats) | `scheduler/` |
| Storage | S3-compatible uploads for task images; avatars as `bytea` in Postgres | `storage/`, `user/avatar.ts` |
| Web | React + TanStack Router/Query, base-ui components, i18n (`i18n/en-US.json`) | `apps/web/src/` |
| Sidebar | Overview group: Projects · Members · Time · Invitations; then the project list | `components/nav-main.tsx` |
| Deploy | Bundled image (`Dockerfile.kaneo`) + Postgres; Helm chart | `compose.yml`, `charts/kaneo` |

Gaps: no employee profile, attendance, schedules, activity, salary, payroll,
leave, expenses, audit log, or desktop client.

## 2. Navigation (the only structural UI change)

The sidebar's Overview group becomes:

```
My work      ← new: personal home (and a one-line company summary for admins)
Projects     (unchanged)
People       ← "Members" grows into this; invite + roles stay where they are
Time         (timesheet → tabs: Time · Attendance · Activity)
Payroll      ← only for people allowed to see pay
Invitations  (unchanged)
```

No new top-level areas beyond these. Everything else lives in tabs of these
pages, an existing dialog pattern, or Settings.

| Feature | Where it lives |
|---|---|
| Employee list | People (the existing members table + department, title, status, today) |
| Employee page | People → person: Overview · Tasks · Time · Attendance · Pay |
| Departments, company schedule, leave allowance, currency, retention | Settings → Workspace → Company |
| Desktop devices | Settings → Account → Devices (connect, see, disconnect your own); admins can revoke through the API |
| Clock in / out, running timer, pause/resume | The card at the bottom of the sidebar, visible on every page |
| Leave request, expenses | My work → "Request leave" / "Add expense" dialogs |
| Approvals | People → Requests tab (leave + expenses in one list) |
| Salary history | People → person → Pay |
| Payroll runs | Payroll |
| Audit log | Settings → Workspace → Audit log |
| Task estimate | Task properties sidebar (one field) + "tracked" next to it |

## 3. Roles and permissions

Four everyday roles, mapped onto what exists:

| Role | Kaneo role | Change |
|---|---|---|
| Owner | `owner` | none |
| Admin | `admin` | gets the new resources below |
| Manager | `manager` | **new default role**, seeded per workspace like viewer/member/admin |
| Employee | `member` | none; `viewer` stays for read-only guests |

New permission resources (everyone always sees and edits *their own* data):

| Resource | Actions | Owner | Admin | Manager | Employee |
|---|---|---|---|---|---|
| `timeEntry` | `read_all`, `manage_all` | ✓ | ✓ | read_all | – |
| `people` | `read_all`, `manage` | ✓ | ✓ | read_all | – |
| `activity` | `read_all` | ✓ | ✓ | ✓ | – |
| `request` | `approve` (leave + expenses) | ✓ | ✓ | ✓ | – |
| `payroll` | `read`, `manage` (salary + payroll) | ✓ | ✓ | – | – |
| `audit` | `read` | ✓ | ✓ | – | – |

Existing workspaces: a one-time SQL migration adds the new resources to
existing `admin` rows (same pattern as `0047`), and the boot seed creates the
`manager` row. Salary and payroll are enforced server-side on every route;
hiding a button is never the check.

## 4. Database changes

All additive; no existing table changes shape except one nullable column on
`task`. Money is stored as integer minor units (paisa for BDT) with the
currency on the workspace. Dates that mean "a day" are `date`; instants are
UTC timestamps; "today" is computed in the workspace timezone.

| Table | Purpose |
|---|---|
| `company_settings` | 1 row per workspace: timezone, currency, work days, start/end, break minutes, annual leave days, overtime multiplier, activity retention (detail/summary days), agent tracking on/off |
| `department` | id, workspace, name |
| `employee_profile` | 1 row per workspace member: title, department, join date, status (active/on leave/inactive), schedule overrides (nullable = company default) |
| `attendance_session` | clock-in/clock-out pairs (many per day), source `web`/`agent` |
| `agent_device` | a paired desktop app: user, workspace, name, platform, **hashed** token, last seen, revoked at |
| `agent_pairing_code` | short-lived one-time code (hashed) to pair a device |
| `activity_span` | detailed spans from the agent: start/end, `active`/`idle`, app name, domain (nullable). Kept N days (default 90) |
| `activity_daily` | per user/day/app/domain totals, updated on ingest. Kept M days (default 365) |
| `salary` | append-only history: amount, type (monthly/hourly), effective from, note |
| `payroll_run` | one month: status draft → approved → paid |
| `payroll_item` | per person: base, overtime, bonus, deduction, net (+ the hours they came from) |
| `leave_request` | type (annual/sick/unpaid), dates, days, reason, status, decided by |
| `expense` | amount, category, description, project, receipt, status pending/approved/rejected/paid |
| `stored_file` | receipts and workspace files: bytes in Postgres (10 MB) or the workspace's R2 bucket (25 MB); `folder`, and a `share_token` while a live link is on |
| `workspace_storage` | a workspace's R2 / S3-compatible bucket; the secret key is AES-256-GCM encrypted |
| `audit_log` | actor, action, target, JSON details, time |
| `task.estimate_minutes` | nullable column for "Estimated 3h · Tracked 2h 17m" |

Indexes follow the queries (per user + time, per workspace + status).

## 5. API

New feature folders under `apps/api/src/`, each with `schema.ts`,
`response.ts`, controllers, and routes registered on `apiRouter()`:

- `company/` — company settings, departments
- `people/` — list (members + profile + today's status), profile get/update, person summary
- `attendance/` — clock in/out, my status, day/week summaries (worked/active/idle/overtime)
- `agent/` — pairing, device list/revoke, heartbeat, activity ingest (device-token auth only)
- `activity/` summary endpoints live in `agent/` to avoid clashing with the existing task `activity/`
- `pay/` — salary history, payroll runs and items, approve/pay
- `requests/` — leave and expenses, approve/reject/pay, receipt upload/download
- `overview/` — the "company today" numbers and the audit log
- `audit/` — `recordAudit()` and the auth-hook recorder for role changes

"My work" composes the endpoints above in the browser instead of adding one.

OpenAPI (`apps/docs/openapi.json`) is regenerated for every route change.

## 6. Desktop agent (`apps/agent`, Tauri v2)

- **Pairing, no admin credentials:** the employee clicks "Connect desktop app"
  (Settings → Account → Devices) and gets a one-time 8-character code (10 min).
  The agent sends server URL + code to `POST /api/agent/device/pair` and receives a
  device token. Only its SHA-256 hash is stored on the server; the token lives in
  the OS keychain. It works only on `/api/agent/*`; revoking the device kills it.
- **Sampling (every 5 s, locally):** idle seconds from the OS
  (Windows `GetLastInputInfo`, macOS `CGEventSourceSecondsSinceLastEventType`),
  foreground app name (Windows `GetForegroundWindow` → process name, macOS
  `NSWorkspace.frontmostApplication`). Idle after 5 minutes without input.
- **Domains, where supported:** macOS reads the active tab URL of Safari/Chrome
  via AppleScript (with the user's automation permission) and keeps only the
  host. Windows gets app names only in v1; domain support on Windows is planned
  as a small browser extension that reports the active tab's host to the agent.
- **Never collected:** keystrokes, clipboard, screenshots, window contents,
  page titles/paths/queries, form data, tokens, files.
- **Sync:** samples merge into spans; every 60 s the agent posts a batch
  (client-generated ids, so retries never double-count) and a heartbeat.
  Offline batches are queued in a local file and sent later. Starts at login,
  survives restarts.
- **Visible, not hidden:** tray icon with status and a "Pause tracking" toggle;
  the employee sees exactly what is shared (their own Activity tab).
- **Builds:** Windows can be built on this machine; macOS needs a Mac or macOS
  CI runner (a workflow is added, signing/notarization is a follow-up).

Presence, active time and idle time are shown as separate numbers. Agent
uptime is never called work time.

## 7. Calculations (kept boring)

- **Worked** = time between clock in and clock out, summed over the day's
  sessions (an open session counts up to now). 10:02 → 19:18 is 9h 16m.
- **Overtime** = worked − the scheduled span (end − start) on a work day;
  everything worked on a day off. Against 10:00–19:00 that example is 16m.
- **Active / idle** = desktop agent spans that day. Shown next to worked time,
  never added to it.
- **Hourly rate** for a monthly salary = base ÷ paid hours in that month, where
  paid hours = (end − start − break) on each scheduled day.
- **Payroll line** = base (monthly), or regular hours × rate (hourly), plus
  overtime hours × rate × overtime %, plus bonus, minus deduction. Draft lines
  are editable (bonus, deduction); approving locks them; paid is final.
- **Leave balance** = yearly allowance − approved annual and sick days that
  year; pending shown separately. Unpaid leave does not count. Days are counted
  on the person's own schedule, so days off are never charged.

No productivity scores. Only facts: tasks done/overdue, tracked, active, idle,
overtime.

## 8. Retention

A daily job deletes `activity_span` older than the detail window (default 90
days) and `activity_daily` older than the summary window (default 365 days).
Both are workspace settings.

## 9. Audit log

`recordAudit()` is called by the controllers that change salary, payroll,
roles/permissions, employee profiles, leave/expense decisions and device
revocation. It never stores secrets.

## 10. Build order and status

| Step | Scope | Status |
|---|---|---|
| 0 | Invite with roles; time tracking (timer, pause/resume, timesheet, CSV) | done |
| 4 | Database foundation: 15 tables, `task.estimate_minutes`, permissions, manager role, admin backfill migrations | done |
| 5 | People: directory, person page, profiles, departments, company settings | done |
| 6 | Tasks: estimate field (tracked / estimated), person → tasks and time | done |
| 7 | Attendance: clock in/out, schedules and overrides, overtime, corrections | done |
| 8 | Desktop agent: pairing, device tokens, revocation, tray app (`apps/agent`) | done for Windows; macOS code path not built here |
| 9 | Activity: ingest, daily totals, Activity tabs, details view, retention job | done |
| 10 | Salary history, monthly payroll (draft → approved → paid) | done |
| 11 | Leave and expenses with receipts, approvals | done |
| 12 | My work, company-today line | done |
| 13 | Audit log (API changes + role/permission changes), permission review | done |
| 14–16 | Tests, production build, Docker | done (image verified against an empty database) |
| 17 | Files: Cloudflare R2 per workspace (tested and encrypted), Files page with folders and drag & drop, revocable live links; receipts use the same storage | done |
| 18 | Roles UI: invite/remove/change-role permissions for custom roles; admins can disconnect someone's computer | done |
| 19 | Security review fixes: role grants need a workspace; stored files served with an inline allowlist and sandbox CSP; storage endpoint must be public HTTPS and can't switch buckets under existing files; real-date validation; no overlapping attendance sessions or activity spans; open sessions left out of payroll; race-safe approvals; pay amounts hidden in audit without payroll:read; body limits | done |
| 20 | Browser extension (Chrome/Edge/Brave, MV3) reporting the active tab's domain to the agent over native messaging, Windows | done; Chrome and Brave not tested live |

Deferred on purpose: teams, payslip PDFs, multi-currency, public holidays, Windows
browser-domain tracking (needs a small browser extension), signed and
notarized agent installers, realtime push for attendance and approvals
(views refresh on focus and after actions).
