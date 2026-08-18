# Sentry

This directory holds Sentry configuration as code, so the alert rules and dashboards that Kaneo depends on are version-controlled and reproducible.

## What lives here

- `alerts.json` — alert rules. Five rules cover first-seen issues, error spikes, missed cron check-ins, slow p95 latency, and MCP error rate. Both `kaneo-api` and `kaneo-web` are covered.

## What's NOT here yet

- Dashboards. The 10 prebuilt dashboards that Sentry ships are still empty (zero widgets each). Filling them in is the next monitoring item.
- Cron monitor creation. These are auto-created the first time each cron job runs (`Sentry.captureCheckIn` from `apps/api/src/scheduler/index.ts`).

## Applying the alerts

### Option A: provisioning script (recommended)

The script lives at `scripts/provision-sentry-alerts.sh`. It reads `sentry/alerts.json`, asks Sentry which rules already exist, and creates the missing ones. Idempotent — re-runs are safe.

```bash
# 1. Generate a Sentry auth token (admin scope)
#    https://sentry.io/settings/account/api/auth-tokens/
#    Scope: org:write (or alerts:write)

# 2. Apply
SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-alerts.sh

# Dry-run first to see what would be created
SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-alerts.sh --dry-run
```

The script targets the EU region (`https://de.sentry.io`). If Kaneo ever moves to the US region, change the `region` field in `alerts.json` (or override `SENTRY_API_BASE`).

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

The cron-missed-check-in rule is special: it doesn't create a Detector because the cron monitors already exist. The script resolves the slug strings in `detector_slugs` to numeric IDs via `GET /api/0/organizations/{org}/monitors/`. If the cron jobs haven't run yet, the monitors don't exist and the script will skip with a warning.

The Sentry API surface used is documented at:
- <https://docs.sentry.io/api/monitors/create-an-alert-for-an-organization/>
- <https://docs.sentry.io/api/monitors/create-a-monitor-for-a-project/>
