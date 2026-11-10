# API agent contract: Kaneo and Quills

These instructions apply throughout `apps/api`. The root guide still applies.
Use this contract for Quills endpoints and any change that crosses the two models.
Read the relevant [database guide](src/database/quills/README.md) sections before changing lifecycle behavior.

The requirements below are mandatory for new or changed behavior. They are not a
claim that every existing route already satisfies them. A nearby implementation
must still be checked against this contract before being copied.

## State the boundary before implementation

Record a short boundary map in the task plan or change description; no separate
planning document is required. Name each touched table and owning schema, the
source of actor/workspace IDs, required Quills and native permissions, persisted
relationships used for authorization, transaction boundaries, and external effects.
Identify the applicable completion checks below. Do not infer authorization from
matching IDs, an existing UI control, a customer email or a cached capability.

## Hard rejection rules

1. Never retry a denied or failed scoped operation through the global database,
   `withQuillsSystemWorkspace`, an administrator identity or a more privileged role.
   Permission/tenant failures must remain failures. Reuse existing platform admin
   semantics; do not add a new role, email allowlist or environment bypass.
2. Quills feature code must not open its own pool/client, manually manage transaction
   scope, change `quills.workspace_id`, use `SET ROLE`/`RESET ROLE`, disable RLS, or
   obtain migration credentials. Only the existing trusted scoping/provisioning
   infrastructure may establish those boundaries. Explicit operator/migration
   connections are not an API implementation pattern.
3. Never trust a body/query copy of `workspaceId`, actor identity, membership, role
   or permission data over the authenticated context. Treat path IDs as selectors
   requiring authorization. Do not spread request bodies into database writes:
   enumerate allowed domain fields and derive protected fields on the server.
4. Check every supplied relationship, including child IDs and bulk-operation IDs,
   against the same authorized workspace and its real parent. A valid TypeID, UUID,
   FK target or an accessible unrelated project is not proof of access. Reads,
   counts, search, exports and downloads require the same ownership checks as writes.
5. Never expose complete database rows, credentials, job payloads or raw SQL/provider
   errors by default. Select/map the response fields intentionally. A declared
   OpenAPI response schema alone is not evidence of runtime filtering. Allowlist
   audit/event/log metadata; do not copy raw request bodies or tokens into it.
6. Never swallow a failed required write and return success. Await database work
   before the callback returns; do not return lazy queries or launch detached work
   that retains its scoped handle.
   Keep domain data and its required audit/outbox changes in one transaction.
   Independent platform/Quills calls do not become atomic because they share a request.
7. Never grant the runtime role broader table access to work around a failed feature.
   Do not bypass a tenant constraint with an application-only precheck. Put ownership,
   uniqueness and concurrency invariants in database constraints/locking as needed,
   and verify them under the restricted runtime path.
8. Never edit applied migration SQL/hashes, rewrite the migration ledger, regenerate
   historical snapshots to hide drift, or manually refresh the manifest to pass
   startup. Make a forward migration; retain separate Kaneo and Quills histories.
9. Never publish external effects from an uncommitted feature mutation, bypass a
   worker lease, or blindly retry an uncertain external outcome. New handlers must
   define deduplication/reconciliation and test retries; a queue row is not proof of
   successful mail/webhook delivery. Object deletion belongs to shared cleanup.
10. Never make a test pass by removing a denial assertion, mocking away the boundary
    being verified, adding skips or relaxing timeouts without diagnosing the cause.
    Update expectations only for an intentional behavior change, with its regression
    proof. Skipped, unavailable and failing checks must be reported separately.

If the existing path cannot provide a required guarantee, identify the missing
behavior and fix it with focused tests. Do not substitute a permissive fallback,
claim completion or expand into an unrelated redesign.

## One platform, two schemas

Both schemas use the same PostgreSQL database and connection pool. Separate schema
and migration ownership does not mean a second service, login or workspace.

| Data | Authority | Source |
|---|---|---|
| Accounts, sessions, workspaces, membership, roles, shared teams, projects, tasks | Kaneo `public` schema and its existing authorization/controllers | [Platform schema](src/database/schema.ts) |
| Feedback boards/posts, tickets, conversations, knowledge-base content and other Quills domain records | Workspace-owned `quills` schema | [Quills schema exports](src/database/quills/schema/index.ts) |
| A teammate acting in Quills | Canonical Kaneo user linked through `principal.kaneo_user_id` | [Workspace client and actor](src/database/quills/client.ts) |
| Customers and visitors | Quills `customer_identity` / domain principals | [Identity schema](src/database/quills/schema/auth.ts) |
| Board/project and post/task relationships | Tenant-safe link tables; native resources remain Kaneo-owned | [Link schema](src/database/quills/schema/platform-links.ts), [route examples](src/quills/links.ts) |
| A Quills team bound to a shared team | Kaneo owns its name and current member roster | [Team bindings](src/quills/teams.ts) |

Do not copy Kaneo users, sessions, invitations, workspaces or workspace memberships
into a second auth system. Quills customers are not automatically platform members.
Imported Quills role catalogues do not authorize teammate API requests. Use Kaneo's
`quills` permissions from `@kaneo/permissions` and its existing API-key scope checks.
Keep workspace name/slug, canonical profiles and bound team rosters under their
existing platform lifecycle hooks; do not maintain parallel copies in controllers.

Kaneo IDs are text. Most Quills entity IDs use UUID-backed TypeIDs; some tables
also have numeric internal or public identifiers. Follow each column's declared
type and keep these identifiers distinct. Use the existing `@kaneo/ids` helpers
and the entity-specific `flexibleToTypeIdSchema` from `@kaneo/ids/zod` where the route accepts both forms.
Use the callback's `actor.principalId` for domain authorship/audit; do not cast a
Kaneo user ID into a principal ID or infer membership by matching email addresses.

## Required request and query path

Read [withQuillsRequest](src/quills/with-quills-request.ts),
[client.ts](src/database/quills/client.ts) and the nearest existing route first.

1. Define the route with the existing OpenAPI/Zod helpers and bounded inputs and
   responses. Mount feature routers through [src/quills/index.ts](src/quills/index.ts).
   Keep the normal authenticated middleware and `workspaceAccess.fromParam("workspaceId")`.
   Read identity/workspace from authenticated context, never from a submitted user ID.
2. Call `withQuillsRequest(c, { action }, async (db, actor) => ...)`, adding
   `projectId` when project authorization applies. It checks platform workspace
   access, `workspace:read`, the requested Quills
   action, API-key scope, and the supplied project's workspace and visibility.
   Choose the actual action; reads are not permission to mutate or manage settings.
3. Pass the callback's branded `Database` handle into Quills domain helpers. Execute
   and await all Quills queries inside that callback. Return resolved data, never
   the transaction or a lazy query builder. Do not use the global platform DB for
   routine Quills queries, manufacture `as Database` casts, set roles/GUCs manually,
   or disable RLS to make a handler work.
4. Check feature ownership, soft-deletion state and domain rules in the handler.
   Workspace RLS is tenant isolation, not project/object authorization. Return
   normal not-found/denied responses without exposing another workspace's records.
   Bound list sizes and batch lookups; preserve pagination after visibility filtering.

Request schemas must bound strings, arrays, page sizes and batch sizes, and validate
IDs with their declared entity type. Explicitly select permitted mutation fields;
caller input cannot assign the audit actor or change a row's tenant. Validate the
same ID source the handler uses: a query parameter must not authorize a different
path/body resource. An unauthorized element must not leave partial bulk mutations;
use all-or-nothing behavior unless a partial-result contract is explicit and tested.

Filter unauthorized records before returning data; do not leak their fields or
aggregate values and rely on the UI to hide them. Scope cursors and caches to the
request's audience, workspace and filters. Make missing/deleted/foreign objects
follow the existing non-disclosing error conventions.

`withQuillsWorkspace` is a lower-level trusted-server helper: it does not replace
request permission or API-key checks. `withQuillsSystemWorkspace` is for trusted
jobs/maintenance, never a shortcut for a caller-supplied workspace. Customer,
public portal and widget routes need explicit audience/ownership authorization;
the teammate helper does not supply that model or authorize a public bypass.

Permissions are checked at request entry. Do not claim that an already-authorized
request is cancelled at commit after a concurrent role/project-grant change.

## Crossing the schema boundary

Use [links.ts](src/quills/links.ts) and [teams.ts](src/quills/teams.ts) as the current
examples. Keep canonical mutations in Kaneo's existing services/controllers.

- A platform read needs an explicit workspace predicate and the native resource's
  permission checks. Quills RLS does not protect `public` tables. Resolve a task's
  actual project from its stored row, not a project ID supplied as proof of access.
  Native writes still require native action permissions; Quills update access
  does not grant project/task mutation rights.
- When access to an existing feature depends on linked projects, resolve its
  persisted links under workspace scope and check those projects. The request
  helper does not discover links or check all projects automatically. For a new
  link, validate both the Quills object and the proposed native target.
- Reuse `board_projects`, `post_tasks` and `teams.kaneo_team_id`. Keep the database
  tenant constraints and native move/delete hooks: removing a native resource or
  moving it to another workspace detaches links without deleting feedback history.
- A call to the global platform DB inside a Quills callback is a separate operation,
  not part of the scoped transaction. If a feature must write both schemas, design
  and test the explicit authorized transaction or durable handoff. Do not assume
  two independently committed controller calls are atomic or broaden runtime grants
  to bypass this boundary.

## Mutations, jobs, files and clients

Record a Quills mutation with [recordQuillsChange](src/quills/events.ts) inside the
same scoped transaction as its data change. Extend its Zod event/entity catalogue
when adding an event; do not cast around the existing allowed values. The helper
writes canonical audit, outbox event and job together. Runtime audit history is
append-only. Do not send mail, webhooks or WebSocket updates before commit.

The [worker](src/quills/jobs/worker.ts) currently dispatches `quills.event` cache
invalidations only. Imported queue tables are not implemented workers. A feature
needing mail or webhook dispatch must add a validated handler, retry/idempotency
behavior and tests; do not turn on old imported jobs implicitly. Preserve leases,
retry limits, workspace isolation and the [retention rules](src/quills/jobs/retention.ts).

Use the shared [storage lifecycle](src/storage/cleanup-queue.ts) and
[Quills storage integration](src/database/quills/storage.ts). Register managed
object keys; retain the shared object lock or verification lease until the
reference commits. Queue cleanup transactionally and check references across both
schemas/workspaces. When adding an object-bearing field, update reference probes,
cleanup triggers, workspace deletion and transfer handling together.

Expose responses through `@kaneo/libs` and the existing
[Quills fetchers](../web/src/fetchers/quills/platform.ts).
Use [useQuillsWorkspace](../web/src/hooks/queries/quills/use-quills-workspace.ts)
and Kaneo's existing workspace selection. Scope caches to the authenticated user
and workspace, clear/hide denied data and handle `QUILLS_CHANGED` invalidation.
Keep API authorization independent of client-side permission checks.

## Schema and migration rules

Quills schema definitions live under `src/database/quills/schema`. New feature
tables must use the existing [tenancy helpers](src/database/quills/tenancy.ts), a
non-null workspace FK, workspace-scoped keys/relations and forced RLS in SQL.
Export new tables through the schema index. Check indexes against the actual
workspace-filtered queries; composite tenant constraints must prevent cross-tenant links.

Use `pnpm --filter @kaneo/api db:generate:quills` from the repository root. Inspect
`drizzle/quills` SQL, snapshots and journal; keep Kaneo's root migration history
separate. Do not call plain drizzle-kit for the Quills lineage or edit applied SQL.
Custom SQL migrations must finish with
`SELECT quills_migrations.capture_schema_manifest();`. Do not recapture a manifest
manually to hide drift. Use [schema-ops.ts](src/database/quills/schema-ops.ts) for
operational indexes and retain interrupted-build recovery and definition validation.

New privileged bridge functions need a documented caller/grant model, a fixed
safe `search_path`, no default `PUBLIC` execute access, and tests for denied callers
and foreign/missing workspace scope where tenant scoping applies. Keep globally
privileged maintenance functions unavailable to request roles. Never add
`SECURITY DEFINER` merely to make a failing feature query run.

Do not use `DROP ... CASCADE`, destructive resets, an unbounded backfill or removal
of tenant constraints as an upgrade shortcut. A required destructive/locking migration must
state affected data, bounded execution strategy, restore/rollback procedure and
its test evidence. Preserve ticket numbers, public help-center IDs and history.

Increment `CATALOGUE_VERSION` only when changing seeded defaults and preserve
workspace customizations. For new data, check [transfer](src/quills/transfer/archive.ts),
retention and deletion behavior, including preserved ticket numbers/help-center
URL IDs, settlement of external effects and excluded auth/runtime records. Follow
the database guide for privileged migration connections, pgvector, backup/restore
and production-scale lock rehearsal.

## Evidence required before completion

For each changed boundary, the following checks are required. Mark a row not
applicable only when that behavior is outside the change, with a short reason.
An endpoint/data-access change cannot mark authorization or tenant isolation not applicable.

| Changed boundary | Required evidence |
|---|---|
| Authenticated endpoint | Authorized success; missing session, denied action and insufficient API-key scope; existing administrator semantics retained |
| Tenant/object access | Two workspaces with fixtures; foreign parent/child IDs and mismatched path/body/query IDs denied; removed membership and archived workspace denied where platform policy requires |
| Native resource link | Inaccessible private project denied and authorized project allowed; actual persisted task/project relationship checked; native permissions enforced independently of Quills permissions |
| Mutation or batch | Inject a failure after a write; verify rollback leaves no partial data/audit/job; unauthorized batch element cannot cause partial unauthorized changes |
| Read/search/export | Unauthorized rows (including foreign/private records), protected fields and aggregate values do not leak; pagination/filter bounds hold |
| Schema or ownership constraint | Real PostgreSQL tests through `quills_runtime` scoping; missing/foreign workspace rejected; concurrent writes cannot defeat the invariant |
| Worker or storage lifecycle | Retry/deduplication, lost/expired lease and failure paths; cleanup respects references and live verification locks/leases; expired verification cannot commit a reference |
| Migration | Fresh startup, concurrent runners, restore/drift rejection and interrupted operational-index recovery; preserve existing customizations/public IDs |
| Client/cache/realtime | User/workspace switch and permission loss do not expose stale data; invalidations reach only the authorized audience |

Do not replace real database isolation tests with mocked successful queries or
superuser-only reads. Reproduce a bug before its fix when practical, and keep the
regression assertion. Verify the handler's real response and persisted outcome,
not only helper invocation counts.

From the repository root, run the relevant focused tests and:

```sh
pnpm --filter @kaneo/api test:quills
pnpm --filter @kaneo/api typecheck
pnpm --filter @kaneo/api build
```

Set `QUILLS_TEST_DATABASE_URL` explicitly to a disposable local database named
`quills_*` for database tests. A skipped database test is not passing evidence.
For contract changes, run `pnpm openapi:check:fix` and inspect `apps/docs/openapi.json`.
For client changes, run web tests/type checks and verify user/workspace cache isolation.
Run scoped formatting/lint. For migration changes, test fresh startup, concurrent
migration runners and restore/drift rejection. Report local results separately
from hosted CI, browser proof and deployment; never use production data for tests.

The completion report must name changed boundaries, commands and results, skipped
checks with reasons, remaining failures/risks, and the Feature Flow review verdict.
Do not claim a full suite passed from a filtered run, a deployment from a local
build, or a delivery from an enqueued job. Required failures mean the affected
portion is incomplete. A missing test environment is a limitation to resolve or
report, not permission to weaken a check.

For documentation-only changes, validate the directives, paths, helper names and
commands against current source and apply the review lenses directly; do not run
unrelated runtime suites. Update this contract and the database guide when a
boundary intentionally changes so future agents do not follow stale instructions.
