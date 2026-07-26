---
name: verify
description: Build/launch/drive recipe for verifying Kaneo changes end-to-end on a local dev instance
---

# Verifying Kaneo changes

## Launch

- `pnpm dev` starts API (1337) and web (5173). Check `lsof -nP -iTCP:1337 -sTCP:LISTEN` first; the user often already has both running.
- API is `tsx watch` — it hot-restarts on any imported .ts change, but NOT on `apps/api/drizzle/*.sql` changes (manual restart needed after editing migrations).
- Migrations auto-run on API startup; a failed migration exits the process (port goes dead).

## Database access

- `DATABASE_URL=$(grep "^DATABASE_URL" .env | cut -d= -f2-); psql "$DATABASE_URL"` — direct Postgres access for asserting rows (notification, task_reminder_sent, user_notification_preference).
- Gotcha: `task.userId` in Drizzle maps to column `assignee_id`, not `user_id`.
- When replicating scheduler SQL by hand, `SET timezone = 'UTC'` first; timestamps are naive UTC.

## Driving flows

- Drive the web UI at localhost:5173 with claude-in-chrome; the user's session is usually signed in.
- Notification bell is top-left next to the workspace switcher; badge updates live over websocket (no refresh needed to observe delivery).
- Due-date picker is date-only (stores local midnight as naive UTC). To trigger the due-date reminder cron (every 5 min, 10-min lookback window) within a session: set the assignee's lead-time preference (Settings > Account > Notifications, in hours) or nudge `task.due_date` via psql so `due_date - lead` lands 2-3 min ahead.
- Preferences save button silently disables for out-of-range lead values.
