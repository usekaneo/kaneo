# Quills database layer

Imported from `quackback/packages/db/src` at source commit `42ef2e01b2b48db87f1a9dadabbe6d57af0dd10c`.

## Ownership and identity

Kaneo owns authentication, user accounts, workspaces, membership and workspace
access. All 147 feature tables live in PostgreSQL schema `quills`.
Every table has a text `workspace_id` referencing Kaneo's workspace. Domain IDs
retain their UUID-backed TypeID representation. Keys, unique constraints and
feature foreign keys include workspace ownership. Nullable composite foreign
keys clear only the optional reference, never the workspace discriminator.

Teammate actors in `principal` link directly to Kaneo through `kaneo_user_id`.
Membership creation and existing-member migration provision these actors atomically.
Membership removal preserves history but immediately removes request access and
legacy Quills role assignments. Rejoining reuses the actor ID. Kaneo name/avatar
changes update the actor; deleting the account anonymizes its historical actor.
Instance administrators retain Kaneo's existing cross-workspace override.

`customer_identity` retains customer/visitor profile data. Its optional text
`kaneo_user_id` links a profile to an existing Kaneo user. A trigger rejects links
to users outside the workspace. Domain principals and Quills RBAC describe
feature permissions; they never grant Kaneo workspace membership.

Use `withQuillsWorkspace({ workspaceId, userId }, callback)` with the user from
Kaneo's authenticated server context. The callback receives the scoped database
handle required by the imported runtime helpers. It checks membership and an
unarchived workspace, holds those rows while the transaction runs, sets a
transaction-local workspace, and switches to a restricted database role.
Feature routes must use `withQuillsRequest` from `src/quills/with-quills-request.ts`.
It checks Kaneo workspace access, the requested Quills action, API-key scopes,
and project visibility when a persisted project relationship is supplied. It then
opens the scoped database transaction and supplies the authenticated actor.
The raw database helper is for trusted server code, not a substitute for request
authorization. Feature-specific object ownership checks still belong to each handler.
Action, API-key scope and project grants are checked at request entry. An already
authorized request can finish after a concurrent grant change; the workspace
transaction does not provide commit-time revocation of those grants.

Trusted background jobs can import `withQuillsSystemWorkspace` from `client.ts`.
Never use that function with an unchecked workspace ID from a request. Partition
maintenance takes an administrative PostgreSQL Client and applies globally;
workspace callbacks cannot access partitions directly or execute DDL.

## Shared API and client foundation

`GET /quills/{workspaceId}/context` returns the existing Kaneo workspace and the
caller's Quills actor. It is available through the typed `@kaneo/libs` client.
The web `useQuillsWorkspace` hook uses the existing workspace selection and hides
cached context on permission loss, a denied response, session changes, or while
the route points to another workspace. Context cache keys include the authenticated
user, and the hook refreshes context on mount.
Feature screens can use this hook and the existing `useWorkspacePermission` hook.

Kaneo's role editor, API-key scopes and capability endpoint expose the `quills`
resource with `read`, `create`, `update`, `delete`, and `manage_settings` actions.
Viewers read; members read/create/update; admins and owners have all five actions.
Existing default roles gain these actions only if their stored permissions match
the previous defaults exactly. Customized and custom roles remain unchanged;
owners can grant Quills access in the same Roles screen. Imported Quills role
catalogues are retained as feature data and do not authorize teammate requests.

Workspace names/slugs are canonical Kaneo fields. Database hooks keep initialized
Quills settings current and prevent Quills writes from overriding those fields.
Quills-specific portal branding remains separate configuration.

## Shared file lifecycle

Managed Quills uploads use Kaneo's configured storage provider and its existing
verified-upload/object-lock protocol. Originals must be registered in `files` or
the relevant document/export table; arbitrary remote URLs are not storage keys.
The lifecycle tracks originals, file/message previews, avatars, portal branding,
assistant documents and exports. Removing or replacing a reference queues cleanup
in the same transaction. Workspace deletion also collects these keys through the
existing deletion flow. The cleanup worker retains any object still referenced by
either Kaneo or Quills, including another workspace.

A restricted security-definer function exposes storage references to the platform
credential only. Its owner has a SELECT policy on the seven storage-bearing tables;
`quills_runtime` keeps workspace RLS and cannot call that platform function.
Migration credentials need trigger privileges on Kaneo's workspace/member/user
tables, profile/workspace SELECT, workspace-role UPDATE, and cleanup-queue INSERT
in addition to the original provisioning privileges. Triggers keep ordinary and
administrator mutation paths consistent without duplicating application hooks.

## Migration workflow

From `apps/api`:

```sh
pnpm db:generate:quills
pnpm db:migrate:quills
pnpm test:quills
```

Keep Kaneo's `drizzle` root SQL, journal and snapshots unchanged. Quills uses
`drizzle/quills`, its own snapshots/journal, and ledger
`quills_migrations.__drizzle_migrations`. The generator handles PostgreSQL's
column-specific SET NULL, partition declarations, forced RLS, and indexes that
must be built outside the migration transaction. Always use the Quills command
instead of invoking drizzle-kit directly for this lineage.

Startup runs existing Kaneo migrations and compatibility steps before Quills.
Quills runs through a dedicated direct connection, serializes with an advisory
lock, checks applied SQL hashes, applies its migrations, creates its restricted
runtime role, repairs invalid operational indexes, prepares partitions, verifies
postconditions, and reconciles reference data for existing active workspaces.
An error prevents API startup. New workspaces initialize their Quills settings and reference data atomically on
first scoped access; concurrent first requests serialize using a transaction lock.

PostgreSQL 15+ with pgvector (HNSW support) and pg_trgm is required. The migration
identity needs extension, schema and role provisioning privileges; ordinary
workspace operations run as `quills_runtime` (NOLOGIN, no superuser or RLS bypass).
Use a direct PostgreSQL endpoint, not transaction-mode PgBouncer; the lock is
session-scoped. Set `QUILLS_MIGRATION_DATABASE_URL` to a privileged direct
connection to the **same database** when the application pool uses a separate
credential. Migration grants `quills_runtime` to the user resolved from Kaneo's
`DATABASE_URL`/`POSTGRES_*`; it does not grant that user role-administration rights.
The application credential still needs the existing Kaneo schema/startup privileges,
including SELECT and row-lock permission (UPDATE on a column) on `workspace` and
`workspace_member` and `user` for membership and identity checks. Provisioning also
grants schema usage and execution of the storage-reference function directly to
the application credential; this works with NOINHERIT without granting raw table access.
Without the override, the existing single-credential provisioning mode is retained.
Daily partition maintenance uses this administrative connection at 00:07 UTC,
coordinates replicas with the migration lock, extends the seven-day window and
removes partitions older than 90 days. Failures use the existing scheduler's
error monitoring; startup repairs the forward window after downtime.
Known pooler hostnames are rejected, but arbitrary proxies cannot
be reliably identified from a URL.

The supplied Compose and Helm configurations use `pgvector/pgvector:0.8.7-pg16-bookworm`
([upstream image documentation](https://github.com/pgvector/pgvector#docker)).
For an existing `postgres:16-alpine` installation, back up and verify a logical
restore before changing images. Stop application writes, take a final logical
backup, and restore it into a **new** PostgreSQL 16 pgvector volume; Alpine and
Debian use different libc/collation implementations, so do not assume an in-place
volume swap preserves index ordering. Keep the old volume and backup for rollback.
Point the application at the restored database, run migrations, and verify health
and workspace isolation before resuming writes. Never run `down --volumes` or
remove the original volume as part of this upgrade. External PostgreSQL providers
must supply these extensions and the documented provisioning privileges before
application startup.

Migrations `0004_kaneo_platform` and `0005_platform_completion` add shared-table
projections and backfills. They hold write-conflicting locks on the affected
workspace, user, membership, project, task and team tables. Drizzle applies pending
SQL in one transaction, so these locks remain until that complete batch commits. Before deploying to a populated
installation, measure the migration on a restored copy with production-scale data
and schedule a maintenance window. `lock_timeout` limits acquiring locks, not the
backfill duration. Stop application writes, retain a verified backup and the old
application artifact, run the migration, and verify health before resuming writes.
If the migration fails, its transaction rolls back; if a committed upgrade must be
reverted, restore the verified backup rather than dropping Quills tables. Local
fixture tests do not establish a production maintenance-window duration.

Do not edit applied SQL. Add a new migration for changes. The database ledger
is independent from Kaneo's, so both streams can have migration number 0000.
Shared startup/build files and changes to referenced Kaneo tables can still need
reconciliation during upstream syncs. Do not use blanket merge drivers.

## Imported and replaced modules

Schema, types, RBAC catalogue, permission mirror, personal-domain data, seeds,
counter repair, visitor rollups, test-data filters and restore side-effect
settlement are adapted locally. Restore handling excludes Kaneo-owned auth
artifacts. Migration execution, version/readiness checks and partition maintenance
use Kaneo's PostgreSQL driver and the new migration history.

The source's login/session/account/verification, 2FA, SSO recovery, invitation,
and OAuth token stores are not duplicated. OAuth client metadata for third-party
apps and widget provenance remain domain data, not an alternative login system.
The source's sample-data generator and Docker reset script are intentionally not
installed: the latter deletes unrelated containers and volumes. No existing
Quackback data is transferred. The source manifest's missing queries directory
is not recreated with placeholder exports.

## Validation

`QUILLS_TEST_DATABASE_URL` enables real database tests. It must point to a
**disposable local PostgreSQL database whose name starts with `quills_`**.
Tests apply both migration histories and create/remove their own workspace
fixtures. Without this variable, database tests are skipped explicitly.
Schema ownership tests still run. API typecheck/build and scoped lint are also
required. Deployment must provide the same migration SQL and workspace package
builds as the local check; both Docker build definitions include these packages.


## Platform completion

Board/project and post/task links enforce workspace ownership. Native deletion
or cross-workspace movement removes the link, preserving feedback. Quills teams
can bind to Kaneo teams; canonical names and current workspace-member rosters
project automatically. Manage shared membership through Kaneo. Each workspace
has at most one active default Quills team.

New audit rows reference the canonical principal. The runtime role can insert and
read audit history, but cannot update or delete it. Canonical workspace deletion
still cascades. Storage cleanup now probes indexed object keys; workspace deletion
lists only that workspace's references. Canonical-user lookups have their own index.

`settings.catalogue_version` gates initialization. Increment `CATALOGUE_VERSION`
when defaults change. Startup rejects extra, missing, changed and noncontiguous
migration history. A migration-backed manifest checks types, defaults, constraints,
all ordinary and unique indexes, RLS, triggers and functions after restore. Operational index
expressions and predicates are compared with PostgreSQL-normalized definitions.
Before the strict manifest comparison, startup repairs missing or invalid known
operational indexes already recorded in the saved manifest. It does not recapture
the manifest or repair unrelated schema drift.
Custom SQL migrations must finish with
`SELECT quills_migrations.capture_schema_manifest();`. Never recapture the manifest
to hide unexpected drift. Authorization remains at request entry; already-authorized
requests can complete during a concurrent role or project-grant change.

## Jobs and retention

The existing scheduler drains `quills.event` every ten seconds. Mutations record
audit, event and job rows atomically. Workers use `SKIP LOCKED`, five-minute fencing
leases, three attempts and bounded backoff. Missing jobs are recovered from the
outbox. Delivery sends only `QUILLS_CHANGED` cache invalidations through the existing
websocket adapter. Delivery is at least once; duplicate invalidations are harmless.
Clients must refetch current state after reconnecting. Other imported feature
queues are not executed. Mail, webhooks and other feature dispatch need registered
handlers when those features are connected.

`GET /quills/{workspaceId}/jobs` is paginated and omits payloads. The
`POST /quills/{workspaceId}/jobs/{jobId}/retry` endpoint requeues a failed registered
job and audits the operator. Both require `quills:manage_settings`. Link and team
routes apply shared permissions and API-key scopes. Typed web callers are in
`apps/web/src/fetchers/quills/platform.ts`.

Hourly retention removes published events after 90 days, terminal jobs after seven
days, and email/AI logs after 90 days, in batches of 1,000 per table/workspace.
It retains audit history, pending work, failed jobs with unpublished events, and
current-month billing logs. Expired export keys enter the existing storage-cleanup
flow. Archived workspaces receive retention but do not execute feature jobs.
Configure days (1–3650) with `QUILLS_EVENT_RETENTION_DAYS`,
`QUILLS_JOB_RETENTION_DAYS` and `QUILLS_LOG_RETENTION_DAYS`.

## Workspace transfer

From `apps/api`, explicitly set `QUILLS_TRANSFER_DATABASE_URL` to the target
platform database. The operator must be a current workspace member with
`quills:manage_settings`. These are operator commands, not upload endpoints.

```sh
pnpm db:transfer:quills --mode export --workspace WORKSPACE_ID --user USER_ID --file /private/path/workspace.json
pnpm db:transfer:quills --mode import --workspace EMPTY_WORKSPACE_ID --user USER_ID --file /private/path/workspace.json --mapping /private/path/mapping.json --dry-run
pnpm db:transfer:quills --mode import --workspace EMPTY_WORKSPACE_ID --user USER_ID --file /private/path/workspace.json --mapping /private/path/mapping.json
```

For the original single-workspace Quackback database, explicitly set
`QUILLS_SOURCE_DATABASE_URL` and run:

```sh
pnpm db:transfer:quills --mode export-legacy --file /private/path/legacy.json
```

Legacy extraction uses a read-only repeatable-read transaction. Platform exports
use a workspace snapshot. Files are created with mode 0600 and must not already
exist. Archives can include customer content and integration credentials; protect
them as private backups. The limit is 64 MiB and 100,000 rows per table. Larger
workspaces need a streaming migration.

The mapping JSON accepts `actors`, `projects`, `tasks`, `teams` and `storage` maps.
Actor keys are raw principal UUIDs from the archive, with canonical target user IDs
as values. Legacy staff require explicit mapping; existing Kaneo staff IDs may be
reused only for current target members. Native project/task/team links require
explicit source-ID to target-ID mappings. Customers do not create platform users.

Link lists use bounded pages (`offset`, `limit`, and `nextOffset`) so private-project
filtering cannot produce an unbounded parameter list.

Targets must contain no feature data beyond initialized defaults and canonical
staff actors. Imports hold an exclusive workspace lock, defer foreign keys until
all rows are present, and commit atomically. Dry runs execute the complete import
then roll back. Canonical profiles, workspace metadata and shared rosters are
reapplied. Runtime jobs, sessions, API keys, outbox history and other ephemeral
tables listed in `omittedTables` are excluded. Restore settlement suppresses
pending external effects and records an audit entry. Unfinished integration operations
are cancelled or marked uncertain, workflows are interrupted, and pending approvals
expire. Historical page views within the 90-day retention window receive UTC daily
partitions inside the import transaction; dates outside that window are rejected.

Objects are not embedded or copied. Copy them to the configured target bucket
first and supply a `storage` key map when paths change. The importer derives keys
from data and locks each key before HEAD verification, retaining those locks through
commit or rollback so cleanup cannot remove a verified object. Keep source objects
until validation succeeds. Feature IDs, ticket numbers and public help-center URL
IDs are preserved. Their shared allocators advance under a transactional lock and
roll back during dry runs; internal numeric telemetry IDs are regenerated.
This workspace transfer does not replace full database backups.

A local synthetic fixture projected 10,000 memberships across 100 workspaces in
46.8 seconds. The indexed canonical-user lookup took 0.143 ms, and an indexed
file-key lookup across 10,000 files took 0.048 ms. These PostgreSQL 18 measurements
confirm the lookup plans, not a production migration window. PostgreSQL 16 CI and
a restored production-scale rehearsal remain rollout gates.

## Table ownership inventory

All entries are workspace-owned, including per-workspace reference catalogues.

| Table | Source schema module |
|---|---|
| `post_activity` | `activity.ts` |
| `agent_skills` | `agent-skills.ts` |
| `ai_usage_log` | `ai-usage-log.ts` |
| `analytics_daily_stats` | `analytics.ts` |
| `analytics_top_posts` | `analytics.ts` |
| `api_keys` | `api-keys.ts` |
| `apps` | `apps.ts` |
| `assistant_events` | `assistant-events.ts` |
| `assistant_guidance_rules` | `assistant-guidance.ts` |
| `assistant_pending_actions` | `assistant-pending-actions.ts` |
| `assistant_tool_calls` | `assistant-tool-calls.ts` |
| `assistant_web_sources` | `assistant-web-sources.ts` |
| `assistant_involvements` | `assistant.ts` |
| `assistant_snippets` | `assistant.ts` |
| `assistant_documents` | `assistant.ts` |
| `audit_log` | `audit-log.ts` |
| `customer_identity` | `auth.ts` |
| `settings` | `auth.ts` |
| `principal` | `auth.ts` |
| `oauth_client` | `auth.ts` |
| `widget_origin_session` | `auth.ts` |
| `widget_identified_session` | `auth.ts` |
| `boards` | `boards.ts` |
| `board_projects` | `platform-links.ts` |
| `post_tasks` | `platform-links.ts` |
| `roadmaps` | `boards.ts` |
| `roadmap_columns` | `boards.ts` |
| `post_tags` | `boards.ts` |
| `changelog_categories` | `changelog-categories.ts` |
| `changelog_entry_categories` | `changelog-categories.ts` |
| `changelog_subscriptions` | `changelog-subscriptions.ts` |
| `changelog_entries` | `changelog.ts` |
| `changelog_entry_posts` | `changelog.ts` |
| `email_sending_domains` | `channel-accounts.ts` |
| `channel_accounts` | `channel-accounts.ts` |
| `channel_identities` | `channel-identities.ts` |
| `conversation_outbound_emails` | `channel-identities.ts` |
| `channel_threads` | `channel-threads.ts` |
| `companies` | `companies.ts` |
| `company_attribute_definitions` | `company-attributes.ts` |
| `connectors` | `connectors.ts` |
| `conversation_attribute_definitions` | `conversation-attributes.ts` |
| `conversation_summaries` | `conversation-summary.ts` |
| `conversation_views` | `conversation-views.ts` |
| `conversation_view_pins` | `conversation-views.ts` |
| `conversations` | `conversation.ts` |
| `conversation_messages` | `conversation.ts` |
| `conversation_message_translations` | `conversation.ts` |
| `conversation_tags` | `conversation.ts` |
| `conversation_tag_assignments` | `conversation.ts` |
| `conversation_participants` | `conversation.ts` |
| `conversation_message_mentions` | `conversation.ts` |
| `conversation_message_reactions` | `conversation.ts` |
| `conversation_message_flags` | `conversation.ts` |
| `email_log` | `email-log.ts` |
| `email_ses_tenants` | `email-ses-tenant.ts` |
| `events` | `events.ts` |
| `export_runs` | `export-runs.ts` |
| `post_external_links` | `external-links.ts` |
| `ticket_external_links` | `external-links.ts` |
| `files` | `files.ts` |
| `hook_deliveries` | `hook-deliveries.ts` |
| `import_runs` | `import-runs.ts` |
| `integration_deliveries` | `integration-deliveries.ts` |
| `integration_sync_operations` | `integration-sync.ts` |
| `integration_sync_attempts` | `integration-sync.ts` |
| `integration_sync_actions` | `integration-sync.ts` |
| `integration_sync_start` | `integration-sync.ts` |
| `integrations` | `integrations.ts` |
| `integration_platform_credentials` | `integrations.ts` |
| `integration_event_mappings` | `integrations.ts` |
| `job_queue` | `job-queue.ts` |
| `kb_categories` | `kb.ts` |
| `kb_articles` | `kb.ts` |
| `kb_article_feedback` | `kb.ts` |
| `hc_redirect_rules` | `kb.ts` |
| `kb_search_queries` | `kb.ts` |
| `kb_article_translations` | `kb.ts` |
| `kb_category_translations` | `kb.ts` |
| `kv_store` | `kv.ts` |
| `rate_bucket` | `kv.ts` |
| `kv_set_member` | `kv.ts` |
| `presence_stream` | `kv.ts` |
| `realtime_overflow` | `kv.ts` |
| `workspace_experiments` | `labs.ts` |
| `macros` | `macros.ts` |
| `post_merge_suggestions` | `merge-suggestions.ts` |
| `post_subscriptions` | `notifications.ts` |
| `notification_preferences` | `notifications.ts` |
| `unsubscribe_tokens` | `notifications.ts` |
| `in_app_notifications` | `notifications.ts` |
| `office_hours_schedules` | `office-hours.ts` |
| `onboarding_emails` | `onboarding-emails.ts` |
| `post_mentions` | `post-mentions.ts` |
| `post_views` | `post-views.ts` |
| `posts` | `posts.ts` |
| `post_tag_assignments` | `posts.ts` |
| `post_votes` | `posts.ts` |
| `post_comments` | `posts.ts` |
| `post_comment_reactions` | `posts.ts` |
| `post_edit_history` | `posts.ts` |
| `post_comment_edit_history` | `posts.ts` |
| `post_notes` | `posts.ts` |
| `push_devices` | `push-devices.ts` |
| `roles` | `rbac.ts` |
| `permissions` | `rbac.ts` |
| `role_permissions` | `rbac.ts` |
| `principal_role_assignments` | `rbac.ts` |
| `segments` | `segments.ts` |
| `user_segments` | `segments.ts` |
| `post_sentiment` | `sentiment.ts` |
| `sla_policies` | `sla.ts` |
| `sla_events` | `sla.ts` |
| `slack_user_links` | `slack.ts` |
| `slack_thread_sessions` | `slack.ts` |
| `status_component_groups` | `status.ts` |
| `status_components` | `status.ts` |
| `status_component_events` | `status.ts` |
| `status_incidents` | `status.ts` |
| `status_incident_templates` | `status.ts` |
| `status_incident_updates` | `status.ts` |
| `status_incident_components` | `status.ts` |
| `status_subscriptions` | `status.ts` |
| `post_statuses` | `statuses.ts` |
| `teams` | `teams.ts` |
| `team_members` | `teams.ts` |
| `ticket_activity` | `ticket-activity.ts` |
| `ticket_subscriptions` | `ticket-subscriptions.ts` |
| `ticket_summaries` | `ticket-summary.ts` |
| `ticket_types` | `ticket-types.ts` |
| `ticket_statuses` | `tickets.ts` |
| `tickets` | `tickets.ts` |
| `ticket_conversations` | `tickets.ts` |
| `ticket_links` | `tickets.ts` |
| `user_attribute_definitions` | `user-attributes.ts` |
| `user_tags` | `user-tags.ts` |
| `user_tag_assignments` | `user-tags.ts` |
| `page_views` | `visitor-analytics.ts` |
| `visitor_devices` | `visitor-analytics.ts` |
| `visitor_stats_daily` | `visitor-analytics.ts` |
| `visitor_top_stats` | `visitor-analytics.ts` |
| `webhooks` | `webhooks.ts` |
| `workflows` | `workflows.ts` |
| `workflow_runs` | `workflows.ts` |
| `workflow_run_events` | `workflows.ts` |
| `workflow_versions` | `workflows.ts` |
| `workspace_assistant_threads` | `workspace-assistant.ts` |
