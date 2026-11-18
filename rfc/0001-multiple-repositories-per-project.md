# RFC 0001: Multiple repositories per project

- **Status:** Draft
- **Issues:** usekaneo/kaneo#791, usekaneo/kaneo#1282
- **Fork branch:** docs/multi-repo-integrations

## 1. Summary

A Kaneo project can currently be linked to at most one repository per git provider. This RFC specifies the implementation that allows any number of repository bindings per project for the GitHub, Gitea, and GitLab integrations.

The core decision: **no new join table is introduced.** The existing integration row already carries everything a repository binding needs (credentials, webhook secret, sync rules, import state, external links). One linked repository therefore corresponds to exactly one row in the integration table, and "multiple repositories per project" means multiple rows that share the same project_id and type.

The change is intentionally additive: every consumer that already references integration_id (external_link, github_import, webhook routing, sync rules) keeps working without structural change. The work is concentrated in one database constraint, the repository identity columns, and the re-keying of the CRUD surface from "the project github integration" to "integration by id".

## 2. Current state inventory

The one-repository-per-project rule is enforced at these points. Each row is a required work item; nothing else assumes a single binding.

| # | Location | Assumption | Required change |
|---|---|---|---|
| 1 | apps/api/src/database/schema.ts | unique(project_id, type) on integration | Drop; replace with repository-scoped uniques |
| 2 | github-integration/controllers/create-github-integration.ts | Finds the single existing row and updates it; 409 when a different repository is requested | Insert a new row per repository; map unique violations to 409 |
| 3 | gitea-integration/controllers/create-gitea-integration.ts | Update-in-place plus an O(n) JSON scan over all gitea rows to reject cross-project duplicate links | Insert per repository; delete the scan (cross-project links are allowed, decision 10.1) |
| 4 | get-/delete-github-integration.ts, get-/delete-gitea-integration.ts | findFirst on (projectId, type) | List query per project; single lookup by integrationId |
| 5 | github-integration/index.ts, gitea-integration/index.ts, gitlab-integration/index.ts | GET/POST/PATCH/DELETE keyed by /project/{projectId} | Add list route and integrationId-keyed routes |
| 6 | plugins/github/services/task-service.ts findAllIntegrationsByRepo | Loads every github row, parses each config JSON, filters in memory | Indexed lookup on (type, repository_key) |
| 7 | integration-sync/controllers/get-integration.ts getSyncIntegration(projectId, provider) | One row per project and provider | Key by integrationId |
| 8 | workflow_rule table and resolveTargetStatus | Rules keyed by (projectId, integrationType, eventType): project-wide per provider | Optional integration_id with type-wide fallback |
| 9 | apps/web fetchers, hooks, and settings components for github/gitea/gitlab | Single integration state per project | List state; per-row mutations and UI |

Already multi-binding capable (no change required):

- external_link is keyed by (integration_id, resource_type, external_id); external issue numbers are repository-scoped, so two repositories in one project cannot collide.
- github_import (resumable import state) is keyed by integration_id.
- The GitHub webhook endpoint is a single route; findAllIntegrationsByRepo already returns all matching bindings and every handler in plugins/github/webhooks iterates them.
- The Gitea and GitLab webhook endpoints are already per-integration (/webhook/:integrationId), each row carrying its own webhook secret.
- Write-back (comments, labels, status transitions, branch patterns) is per-integration config and therefore already isolated per repository.
- Task numbering (claimTaskNumber) is project-scoped: all repositories feed one task sequence, which is exactly the global overview requested in #791.

## 3. Goals and non-goals

Goals:

1. Link N repositories per project per provider, within the existing integration table.
2. Preserve all existing per-binding behavior: sync rules, workflow rules, imports, webhooks, write-back.
3. Enforce uniqueness in the database, not in application scans.
4. Keep the API backward compatible during a staged rollout.

Non-goals (out of scope for this RFC):

- Multi-instance support for the non-git integrations (Slack, Discord, Mattermost, Telegram, generic webhook).
- A shared per-instance credential store for Gitea/GitLab tokens (noted as a follow-up in section 11).
- Retiring the legacy github_integration table (separate cleanup PR; see section 10).

## 4. Target design

### 4.1 Repository identity

Repository coordinates move from config JSON into indexed columns, with a canonical key per provider:

| Provider | repository_key format | Example |
|---|---|---|
| github (verified binding) | github:<numeric repository id> | github:402311029 |
| github (legacy, unverified) | github:<owner>/<name>, lowercased | github:usekaneo/kaneo |
| gitea | gitea:<normalized baseUrl>/<owner>/<name>, lowercased | gitea:https://git.example.com/kaneo/api |
| gitlab | gitlab:<normalized baseUrl>/<full project path>, lowercased | gitlab:https://gitlab.example.com/group/subgroup/app |

Legacy GitHub configs without a numeric repository_id fall back to the owner/name key and are upgraded to the numeric id through the existing re-verification flow (hasVerifiedGitHubBinding); this mirrors how legacy integrations are handled today.

The columns are derived, denormalized data maintained on create and update. Config JSON remains the source of truth for provider-specific settings (sync rules, branch pattern, status transitions, tokens, webhook secret).

### 4.2 Schema

In apps/api/src/database/schema.ts, the integration table becomes:

~~~ts
export const integrationTable = pgTable(
  "integration",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: text("type").notNull(),
    config: text("config").notNull(),
    // Repository identity, derived and backfilled from config
    repositoryKey: text("repository_key"),
    repositoryOwner: text("repository_owner"),
    repositoryName: text("repository_name"),
    repositoryId: integer("repository_id"),
    baseUrl: text("base_url"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("integration_projectId_idx").on(table.projectId),
    index("integration_type_idx").on(table.type),
    index("integration_type_repositoryKey_idx").on(table.type, table.repositoryKey),
    // Cross-project repository sharing is allowed (decision 10.1), so there
    // is deliberately no instance-wide unique on (type, repository_key).
    unique("integration_project_type_repository_key_unique").on(
      table.projectId,
      table.type,
      table.repositoryKey,
    ),
  ],
);
~~~

Uniqueness semantics:

- integration_project_type_repository_key_unique: the same repository cannot be linked twice to the same project. Replaces the current disconnect-first 409 logic. Existing rows have a NULL repository_key until backfilled; PostgreSQL unique constraints treat NULLs as distinct, so legacy single-repo rows remain valid until the backfill runs.
- There is deliberately no instance-wide unique on (type, repository_key): one repository may feed several projects (decision 10.1). The Gitea-only O(n) duplicate scan is removed with the behavior change; the GitHub webhook layer already fans out to every matching binding.

### 4.3 Migration

One drizzle-kit migration into apps/api/drizzle plus a custom SQL step (precedent: plugins/github/migration.ts, src/migrations/column-migration.ts). The migration is generated separately from the schema change with pnpm db:generate (the schema change has landed on feat/multi-repo-integrations; the migration follows in its own PR). Order matters:

1. Add the new nullable columns.
2. Backfill from config JSON:

~~~sql
UPDATE integration SET
  repository_owner = (config::jsonb ->> 'repositoryOwner'),
  repository_name  = (config::jsonb ->> 'repositoryName'),
  repository_id    = NULLIF(config::jsonb ->> 'repositoryId', '')::int,
  base_url         = (config::jsonb ->> 'baseUrl'),
  repository_key   = CASE type
    WHEN 'github' THEN 'github:' || COALESCE(
      config::jsonb ->> 'repositoryId',
      lower(config::jsonb ->> 'repositoryOwner') || '/' || lower(config::jsonb ->> 'repositoryName'))
    WHEN 'gitea' THEN 'gitea:' || (config::jsonb ->> 'baseUrl') || '/' ||
      lower(config::jsonb ->> 'repositoryOwner') || '/' || lower(config::jsonb ->> 'repositoryName')
    WHEN 'gitlab' THEN 'gitlab:' || (config::jsonb ->> 'baseUrl') || '/' ||
      lower(config::jsonb ->> 'projectPath')
  END;
~~~

3. Create the per-project unique index. Because unique(project_id, type) currently guarantees at most one row per project and type, the new unique cannot be violated by existing data. No instance-wide index is created (decision 10.1).
4. Drop integration_project_type_unique.
5. Add workflow_rule.integration_id (nullable text, FK to integration, cascade delete). Existing rules keep NULL and therefore keep their current type-wide semantics; no data change is required.

Rollback guard: before re-adding the old unique, assert count(*) equals count(distinct (project_id, type)). The migration stays reversible until users actually link a second repository.

Deploy order: schema migration first, controllers afterwards. Old code reads and writes the config JSON as before; the new columns are additive.

## 5. Work packages

### WP0 — Database schema

- Files: apps/api/src/database/schema.ts, apps/api/src/database/relations.ts (unchanged; integration relations already define project and externalLinks), apps/api/drizzle/<next>_multi_repo_integrations.sql (separate PR).
- Content: section 4.2 and 4.3. Status: implemented on feat/multi-repo-integrations - repository identity columns, the per-project unique on (project_id, type, repository_key), and workflow_rule.integration_id with cascade delete/update and index.
- Migration: not generated in the schema commit; run pnpm db:generate against the landed schema and commit the result separately, together with the backfill and the rollback guard from section 4.3.
- Acceptance: schema compiles; db:generate produces the migration; db:migrate runs on a database with existing single-repo rows and leaves repository_key populated for every github/gitea/gitlab row; rollback guard passes.

### WP1 — Access control middleware

- Files: apps/api/src/integrations/middleware.ts (extend), apps/api/src/utils/workspace-access-middleware.ts (reuse).
- Add workspaceAccess.fromIntegration(paramName): loads the integration, resolves integration -> project -> workspace, and sets the same context as fromProject. This is security-relevant: without it, integrationId-keyed routes would let an authenticated user address bindings of another workspace.
- Acceptance: an integrationId from another workspace yields 403 in route tests; manage_settings is still required for mutations.

### WP2 — GitHub backend

Controllers (apps/api/src/github-integration/controllers/):

- create-github-integration.ts: keep verifyRepositoryOwner per repository; insert a new row with derived identity columns; write the repository_key as github:<repositoryId>; catch unique violations and return 409 with a repository-specific message (already linked to this project); delete the disconnect-before-switching rule.
- get-github-integration.ts: add listGithubIntegrations(projectId) returning an array; each row enriched with verification state (hasVerifiedGitHubBinding) and import progress when a matching github_import run exists. Keep a getGithubIntegration(integrationId) single lookup.
- delete-github-integration.ts: delete by integrationId.
- import-issues.ts: accept integrationId; state in github_import is already keyed by integration.
- verify-github-installation.ts and list-user-repositories.ts: optionally annotate already-linked repositories (and the projects they feed) so the picker can guide; cross-project links are allowed (decision 10.1), so annotation is informational rather than blocking.

Plugin (apps/api/src/plugins/github/services/task-service.ts):

~~~ts
export async function findAllIntegrationsByRepo(source: GitHubWebhookSource) {
  const repositoryKey = "github:" + String(source.repository.id);
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.type, "github"),
      eq(integrationTable.repositoryKey, repositoryKey),
      eq(integrationTable.isActive, true),
    ),
    with: { project: true },
  });
  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GitHubConfig;
      return hasVerifiedGitHubBinding(config);
    } catch {
      return false;
    }
  });
}
~~~

This removes the full-table JSON scan and improves webhook latency on large instances.

Routes (apps/api/src/github-integration/index.ts):

| Operation | Current | Target |
|---|---|---|
| Link | POST /project/{projectId} | unchanged path, new semantics: adds a binding |
| List | — | GET /project/{projectId}/integrations |
| Detail | GET /project/{projectId} | GET /integration/{integrationId} |
| Update | PATCH /project/{projectId} | PATCH /integration/{integrationId} |
| Delete | DELETE /project/{projectId} | DELETE /integration/{integrationId} |
| Import | POST /import-issues | body gains integrationId |
| Webhook | POST /webhook | unchanged |

IntegrationId-keyed routes use workspaceAccess.fromIntegration; list and link routes keep fromProject. The PATCH route keeps its optimistic-concurrency config compare. OpenAPI response schemas in github-integration/response.ts change from nullable single objects to arrays for list routes; single-object schemas for the id-keyed routes.

### WP3 — Gitea backend

Mirror of WP2 (apps/api/src/gitea-integration/):

- create-gitea-integration.ts: insert a new row per repository with a fresh webhookSecret per row; delete the allGitea conflict scan (cross-project links are allowed, decision 10.1, so the scan is obsolete); per-project unique violations map to 409.
- get/delete/update: same re-keying as GitHub. The webhook secret is exposed only to manage_settings callers, as today.
- list-gitea-repositories.ts: annotate linked state per listed repository.
- import-gitea-issues.ts: accept integrationId.
- Webhook route /webhook/:integrationId: unchanged.

### WP4 — GitLab backend

Same re-keying in apps/api/src/gitlab-integration/ and plugins/gitlab/. GitLab keys on a project path rather than owner/name; repository_key uses the normalized baseUrl plus the lowercased full project path. The per-integration webhook route is already in place.

### WP5 — Integration sync

- Files: apps/api/src/integration-sync/ (index.ts, controllers/get-integration.ts, preview-rules.ts, save-rules.ts, review-resume.ts, resume-sync.ts, lock-resume-scope.ts, authorized-project.ts).
- getSyncIntegration(projectId, provider) becomes getSyncIntegration(projectId, integrationId), validating that the integration belongs to the project; all five routes pass the id through. Rules, preview tokens, and paused-link review remain scoped per row, which is the correct granularity: each repository gets its own label mappings and outgoing rules.
- Route shape: /integration-sync/integration/{integrationId} (plus nested /preview, /links/{linkId}/review, /links/{linkId}/resume).
- Events: integration.sync_rules_changed already carries integrationId; the web client should invalidate per integration, not per project.

### WP6 — Workflow rules

- Files: apps/api/src/workflow-rule/ (schema, index, controllers/upsert-workflow-rule, get-workflow-rules), apps/api/src/database/schema.ts (WP0).
- upsertWorkflowRule accepts an optional integrationId; a NULL integration_id keeps the current meaning (applies to every repository of that type in the project).
- Resolution in resolveTargetStatus: prefer a rule matching (projectId, integrationType, eventType, integrationId); fall back to (projectId, integrationType, eventType, NULL).
- The public API shape for type-wide rules is unchanged, so the current workflow editor keeps working; a per-repository selector is added in WP7.

### WP7 — Web frontend

Specified in sections 6 and 7. Summary of the file work:

- New fetchers: list-github-integrations.ts, list-gitea-integrations.ts, list-gitlab-integrations.ts; per-integration variants of update/delete/import (id in the payload).
- Hooks: queries return arrays; mutation payloads carry integrationId.
- Components: split each settings component into repository-list, repository-card, and a connect form used for the first repository; reuse repository-browser-modal.tsx and gitea-repository-browser-modal.tsx for adding repositories.
- Sync rules UI (components/project/sync-rules/): per-binding scope.
- i18n: new keys under settings:githubIntegration / settings:giteaIntegration namespaces in i18n/.

### WP8 — Documentation, OpenAPI, MCP

- apps/docs: user-facing pages for the three integrations describe multiple repositories per project.
- openapi:export refresh after route changes; review packages/mcp for affected endpoints and version the change.
- This RFC is the internal design record and stays in the repo.

### WP9 — Tests

New and extended suites under tests/ (existing examples: tests/api-integration/integration-sync-settings.test.ts, integration-sync-rules.test.ts, pull-request-task-links.test.ts, plugins/gitlab/webhook-handler.test.ts):

| Case | Level |
|---|---|
| Migration backfills repository_key for existing rows (all three providers) | migration test |
| Link two github repositories to one project; both webhooks create tasks with distinct links | api-integration |
| Duplicate link to the same project returns 409 (unique violation mapping) | api-integration |
| Linking a repository already bound to another project succeeds (cross-project sharing, decision 10.1) | api-integration |
| Concurrent create of the same repository in the same project: exactly one row survives | api-integration |
| Linking beyond the plan limit returns 402 with used/limit in the body (WP10) | api-integration |
| Delete one binding: the other stays active; external links of the deleted row cascade | api-integration |
| findAllIntegrationsByRepo resolves via repository_key including legacy owner/name keys | unit |
| Sync rules keyed by integrationId; preview/save/review/resume per binding | api-integration |
| Workflow rule resolution: repository-specific rule wins over type-wide fallback | unit |
| fromIntegration middleware: foreign-workspace integrationId yields 403 | api-integration |
| Gitea webhook per integrationId with per-row secret | api-integration |
| Web settings list: render N bindings, add flow, disconnect confirmation | component tests |

### WP10 — Plan limits

Lands last, after all backends and the frontend, so that quota enforcement never blocks an existing single-repo install upgrading.

- Files: apps/api/src/utils/ (new plan-limits module reading per-plan repository caps from configuration), the create controllers of the three git integrations (enforcement point), apps/web settings components (quota display).
- Limits: git integration rows per project, counted per project (not per provider), so the cap matches what a user perceives as repositories in this project. Free tier: 1; paid tiers: configurable with a generous default.
- Enforcement: the create path counts the project's current git integration rows and, when the plan limit is reached, returns 402 Payment Required with a machine-readable code (repository_quota_exceeded) and the used/limit values in the body; the web UI renders used/limit per provider section and never disables a control silently - a disabled connect button always states the reason and the upgrade path.
- Acceptance: linking beyond the limit returns 402 with quota fields; raising the plan limit immediately allows another link; component tests cover the quota display and the explained disabled state.

## 6. Frontend UX specification

### 6.1 Design contract and dials

The visual contract is the existing Kaneo design system: Geist variable type, the Radix-based component primitives in apps/web/src/components/ui, current Tailwind tokens, and lucide-react icons. No new visual language, palette, or typography is introduced on the settings surface. The plan deliberately constrains itself to it:

- DESIGN_VARIANCE: 4 — a settings surface inside an existing product; consistency over novelty.
- MOTION_INTENSITY: 3 — transitions only where they explain a state change (list add/remove, dialog enter/exit).
- VISUAL_DENSITY: 8 — repository rows carry identity, status, metadata, and actions in one scan.

### 6.2 Information architecture

Project settings keeps one section per provider (GitHub, Gitea, GitLab). Each section renders:

1. A repository list: single-column rows, one row per binding. Not a card grid.
2. An add action at the section top, visible only to users with workspace:manage_settings.

Repository row contents, left to right:

- Identity: owner/name (GitHub/Gitea) or project path (GitLab), with the instance host as secondary text for Gitea/GitLab.
- Status: chips for Active, Paused (is_active false), and Needs verification (legacy binding), derived during render from the list data.
- Meta: linked issue count and last import state when available.
- Actions: overflow menu with Sync rules, Workflow rules, Import issues, Disconnect.

First-repository flow: when the list is empty, the section shows the current connect form unchanged. After the first link, the form is replaced by the list, and adding repositories happens through the existing repository browser modal. This keeps the entry experience identical to today and makes multi-repo an additive capability.

Disconnect confirmation: a dialog that states exactly what happens — the binding, its external links, and its import state are removed; tasks created from its issues stay in the project.

The one memorable element for this surface: the list reads as a sync overview, not a config table. Each row carries a live status chip derived from the binding state (active, paused, needs verification) so a project owner sees at a glance which repositories feed the project. This is achieved with the existing Badge primitive and no new visual vocabulary.

### 6.3 UX constraints

- Sentence case for all new labels and headings.
- No new gradients, glows, or accent canvases; status color semantics follow the existing badge variants.
- No three-equal-card layouts; the list is a single column with row separators.
- Realistic text in documentation and empty states; no placeholder tokens in markup.
- Keyboard: rows are focusable, the overflow menu is reachable and operable by keyboard, focus moves into and out of the browser modal and dialogs correctly.
- Empty, loading (skeleton rows), error (retry action), and partial (needs verification) states are specified for every new surface.

### 6.4 Accessibility

- Dialogs and menus use the existing Radix primitives, which provide focus trapping and roles by default; do not replace them with ad-hoc markup.
- Status chips expose their meaning as text, not color alone.
- The disconnect confirmation is an AlertDialog, not a toast.

## 7. React implementation notes

Stack context: React with Vite, TanStack Query, TanStack Router, react-hook-form with zod. The notes below map the concrete rules applied to this work; they are acceptance criteria for the frontend PR, not optional style advice.

| Rule | Application |
|---|---|
| async-parallel | The list query and the app-info query run as independent useQuery calls; no fetching chain |
| client-swr-dedup | Query keys: [provider + "-integrations", projectId] for the list; detail-scoped work keys on the list, not on unrelated project queries |
| rerender-no-inline-components | RepositoryCard and its menu are module-scope components; nothing is defined inside the list component |
| rerender-derived-state | Counts and flags (hasBindings, needsVerificationCount) are derived with useMemo during render, never set from effects |
| rerender-functional-setstate | Optimistic add/remove of rows in the list uses functional updates on the query cache |
| js-set-map-lookups | Cross-referencing browser modal results with linked bindings uses a Map keyed by repositoryKey, not repeated find() over the array |
| rendering-conditional-render | Ternaries for conditional rendering where a falsy value could render an unwanted node |
| bundle-dynamic-imports | The repository browser modal is imported lazily; it is only needed when the add action is opened |
| rerender-memo | Row components are memoized; the list may grow into dozens of bindings |

Structural note: the current github-integration-settings.tsx is around 29,000 characters. The frontend PR splits each provider settings component into repository-list, repository-card, and connect-form components, each well under 200 lines, and shares the row layout across the three providers (a single integration-repository-row component parameterized by provider metadata) to avoid three divergent implementations of the same list.

Fetchers stay thin and typed against the OpenAPI response schemas; zod schemas are shared between fetcher and hook so list and detail shapes cannot drift.

## 8. Backward compatibility and rollout

| Consumer | Compatibility approach |
|---|---|
| Web app | Deployed after the API; list endpoints are additive; the old project-keyed GET can temporarily return the first binding until the new client ships |
| MCP package | Affected endpoints reviewed in WP8; version bump when response shapes change |
| OpenAPI consumers | openapi:export refreshed; array shapes documented |
| Self-hosted instances | Schema migration is additive; running old API against the new schema is safe |

Order: WP0 -> WP1 -> WP2/WP3/WP4 -> WP5 -> WP6 -> WP7 -> WP8 -> WP10, with tests landing inside each PR rather than at the end. WP10 is last by design: existing single-repo installs must never hit a quota while upgrading.

## 9. PR slicing

| PR | Content | Depends on | Rough size |
|---|---|---|---|
| 1 | WP0 schema (landed on feat/multi-repo-integrations) and the generated migration incl. backfill and rollback guard | — | S |
| 2 | WP1 fromIntegration middleware and tests | — | S |
| 3 | WP2 GitHub backend, routes, OpenAPI | 1, 2 | M |
| 4 | WP3 Gitea backend | 1, 2 | M |
| 5 | WP4 GitLab backend | 1, 2 | M |
| 6 | WP5 integration-sync re-keying | 3 | M |
| 7 | WP6 workflow rule integration_id and fallback resolution | 1 | M |
| 8 | WP7 web: lists, cards, add flow, i18n | 3–5 | L |
| 9 | WP8 docs, OpenAPI export, MCP review | 3–5 | S |
| 10 | Cleanup: retire legacy github_integration table and get-github-integration-by-repository-id.ts | 3 | S |
| 11 | WP10 plan limits: quota service, 402 enforcement, quota display | 8 | S |

PRs 3, 4, and 5 are structurally identical; landing GitHub first gives a review template for the other two.

## 10. Decisions

1. **Cross-project repository sharing - resolved: allowed.** The GitHub webhook layer already supports one repository feeding multiple projects, and the product direction follows that model. The schema enforces only the per-project unique (project_id, type, repository_key); there is no instance-wide unique on (type, repository_key). The Gitea duplicate scan is removed with the behavior change.
2. **Per-plan limits - resolved: in scope as WP10.** Repository count per project is capped per plan; the free tier is capped at 1. Enforcement returns 402 with the quota in the body, and the settings UI shows used/limit with an explained upgrade path. WP10 lands last.
3. **Shared Gitea/GitLab credentials - open.** Each row stores its own token; linking two repositories on one instance duplicates the secret. A per-(workspace, baseUrl) credential store is the logical follow-up.
4. **Shared defaults - open.** Whether sync and workflow rules should offer a copy-to-all-repositories action in the UI.
5. **Non-git integrations - open.** Whether the multi-instance pattern should eventually extend to Slack, Discord, Mattermost, Telegram, and generic webhooks.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Unique violation surfaces as a 500 instead of 409 | Map constraint names to messages in a shared helper; covered by tests |
| Legacy GitHub configs lack repositoryId | owner/name key; upgrade through re-verification, mirroring hasVerifiedGitHubBinding flow |
| API consumers break on array shapes | Compat shim (first binding from old GET) until consumers migrate; MCP version bump |
| Large instances: webhook fan-out across many bindings | Indexed lookup replaces the JSON scan; handlers already iterate bindings |
| UI drift between the three provider sections | Shared repository-row component (section 7) |

## 12. References

- Concept draft and architecture analysis: this RFC supersedes the working document in the upstream issues discussion.
- Related issues: usekaneo/kaneo#791 (multiple GitHub repositories), usekaneo/kaneo#1282 (multiple Gitea repositories), usekaneo/kaneo#928 (private repositories, closed).
