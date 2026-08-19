# Sentry

This directory holds Sentry configuration as code, so the alert rules and dashboards that Kaneo depends on are version-controlled and reproducible.

## Contents

- `alerts.json` — alert rules. Six rules cover first-seen issues, error spikes, missed cron check-ins, slow p95 latency, and MCP error rate. Both `kaneo-api` and `kaneo-web` are covered.
- `dashboards.json` — four Kaneo-specific dashboards (Backend, Frontend, MCP, Cron Monitors) with widgets for the metrics above. The prebuilt Sentry templates are left untouched.

## What's NOT here yet

- Cron monitor alert. The cron jobs in `apps/api/src/scheduler/index.ts` call `Sentry.captureCheckIn` with stable slugs (`due-date-reminders`, `project-webhook-reminders`, `seat-reconciliation`, `trial-reminders`). The Sentry monitors are auto-created the first time each job runs after the next deploy. Once they exist, the next run of `provision-sentry-alerts.sh` will resolve the slugs and create the cron-missed workflow.

## Applying the alerts

### Option A: provisioning script (recommended)

The script lives at `scripts/provision-sentry-alerts.sh`. It reads `sentry/alerts.json`, finds existing workflows by name, and **post-or-puts** so edited specs propagate. 

```bash
# 1. Generate a Sentry auth token (admin scope)
#    https://sentry.io/settings/account/api/auth-tokens/
#    Scope: org:write (or alerts:write)

# 2. Apply
SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-alerts.sh

# Dry-run first to see what would be created or updated
SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-alerts.sh --dry-run
```

The script targets the EU region (`https://de.sentry.io`). If Kaneo ever moves to the US region, change the `region` field in `alerts.json` (or override `SENTRY_API_BASE`).

If you rename an alert in `alerts.json`, the old name stays in Sentry alongside the new one. Rename alerts only when you intend to delete the old one manually.

### Option B: manual setup via the Sentry UI

For each rule in `alerts.json`, walk through Settings > Alerts > Create Alert. The JSON is human-readable enough to drop in to the Sentry UI form fields. Tables of the conditions are at the top of `alerts.json`; the `_comment_*` keys are stripped before applying.

## After applying

The script creates the rules but does NOT wire up notifications. Each rule lands in Sentry with an empty `actions` array so you can choose the right channel per rule. To finish setup:

1. Settings > Alerts > [rule name] > Actions
2. Pick a notification target. Recommended:
   - Slack `#engineering` for spike/latency/cron-missed
   - Email to on-call for new issues and MCP errors
3. Save.

Once notifications are wired, the rules start firing based on the events flowing through `Sentry.captureException` (anywhere in the codebase) and `Sentry.captureCheckIn` (the four cron jobs).

## Schema notes

Two rule families:

- **Issue rules** (`kind: "issue"`) — trigger on event condition types (first_seen_event, regression_event, etc.). One JSON entry per rule.
- **Metric rules** (`kind: "metric"`) — trigger on aggregate conditions (count, p95, failure_rate). Each entry creates a Detector (the metric source) and a Workflow (the alert) and links them via `detectorIds`.

## Applying the dashboards

`scripts/provision-sentry-dashboards.sh` reads `sentry/dashboards.json` and creates-or-updates each dashboard by title. The script preserves any filter settings (projects, environment, period) the maintainer has set in the Sentry UI by reading the current dashboard first and only swapping the widgets array.

```bash
SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-dashboards.sh
SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-dashboards.sh --dry-run
```

The prebuilt Sentry dashboards (Backend Overview, Frontend Overview, etc.) are **not** touched. Kaneo-specific dashboards are created with the `Kaneo:` prefix.

## Schema notes

### Alerts

Two rule families:

- **Issue rules** (`kind: "issue"`) — trigger on event condition types (first_seen_event, regression_event, etc.). One JSON entry per rule.
- **Metric rules** (`kind: "metric"`) — trigger on aggregate conditions (count, p95, failure_rate). Each entry creates a Detector (the metric source) and a Workflow (the alert) and links them via `detectorIds`.

The cron-missed-check-in rule is special: it doesn't create a Detector because the cron monitors already exist. The script resolves the slug strings in `detector_slugs` to numeric IDs via `GET /api/0/organizations/{org}/monitors/`. If the cron jobs haven't run yet, the monitors don't exist and the script will skip with a warning.

### Dashboards

Each dashboard entry has:
- `title` — dashboard name
- `widgets` — array of `{ title, displayType, interval, queries }` objects
- `queries` — array of `{ fields, aggregates, columns, query, orderby, limit }`
  - `fields` — columns to display
  - `aggregates` — aggregate functions to compute (e.g., `count()`, `p95(transaction.duration)`)
  - `columns` — group-by fields
  - `query` — Sentry search filter (e.g., `event.type:error project:kaneo-api`)
  - `orderby` — sort field (e.g., `-count()`)
  - `limit` — required on every query; max is 10. The script uses 10 for all queries.

Performance metrics use `event.type:transaction is_transaction:true` (the dataset migration removed `dataset: transactions`). Error metrics use `event.type:error`. Cron check-in events use `event.type:transaction monitor.check_in_id:*`.

The Sentry API surface used is documented at:
- <https://docs.sentry.io/api/monitors/create-an-alert-for-an-organization/>
- <https://docs.sentry.io/api/monitors/create-a-monitor-for-a-project/>
- <https://docs.sentry.io/api/dashboards/create-a-new-dashboard-for-an-organization/>
