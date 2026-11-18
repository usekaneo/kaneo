# Migration Journal Timestamp Ordering

## Background

Drizzle records each applied migration in the `drizzle.__drizzle_migrations`
table and stores the journal entry's `when` value as `created_at`. On startup,
the migrator only applies journal entries whose `when` timestamp is newer than
the newest `created_at` already recorded in the database.

This means journal entries must be strictly monotonically increasing in
`when`, in journal order. An entry with a `when` value that is older than an
entry a database has already applied is silently skipped on every startup.

## Incident

Migrations `0073_sprint_planning`, `0074_sprint_carry_over` and
`0075_multi_repo_integrations` were added to the journal with hand-picked
`when` values (`1791800000000`, `1791800000001`, `1791817861615`) that were
lower than `0072_instance_webhooks` (`1793132486358`).

Any database that had already applied migration `0072` therefore never applied
`0073`-`0075`. The runtime schema (Drizzle `schema.ts`) expects the columns
introduced by those migrations, which produced errors such as:

```
error: column externalLinkTable_integration.repository_key does not exist
```

The failing cron jobs were `deferred-issue-edits` and `deferred-label-fields`,
both of which join the `integration` table and select the multi-repository
columns introduced by `0075_multi_repo_integrations`.

## Fix

The `when` values of journal entries 73-75 were raised above the highest
previously recorded value and ordered monotonically:

| idx | tag | old `when` | new `when` |
| --- | --- | --- | --- |
| 73 | `0073_sprint_planning` | `1791800000000` | `1793132500000` |
| 74 | `0074_sprint_carry_over` | `1791800000001` | `1793132600000` |
| 75 | `0075_multi_repo_integrations` | `1791817861615` | `1793132700000` |

With timestamps above the recorded `created_at`, the migrator picks the
entries up again on the next API startup and applies them.

`0073_sprint_planning` and `0074_sprint_carry_over` were also rewritten to be
idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded
constraints, `CREATE INDEX IF NOT EXISTS`), matching the style already used by
`0075_multi_repo_integrations`. This keeps the replay safe even for databases
that were partially repaired by hand.

## Known Remaining Anomalies

Journal entries 25 (`0025_early_owl`, `when` 1775156843372) and 26
(`0026_encrypt_notification_preference_secrets`, `when` 1775102400000) also
have `when` values lower than entry 24. Databases that were upgraded live
through migration 0024 may have skipped them as well. They were deliberately
left untouched here: `0026` rewrites secret material and replaying it is not
provably safe. If an older instance shows symptoms related to those schemas,
inspect `drizzle.__drizzle_migrations` for the affected database before
acting.

## Operator Notes

- No manual SQL is required. Restarting the kaneo-api container applies the
  previously skipped migrations automatically.
- When adding migrations by hand, either let `drizzle-kit generate` set the
  timestamp or make sure the `when` value in `apps/api/drizzle/meta/_journal.json`
  is higher than the previous entry's.
- If a database still reports `repository_key does not exist` after a restart,
  verify that the `drizzle.__drizzle_migrations` table's newest `created_at`
  is lower than `1793132700000` and inspect the startup logs for migration
  errors.
