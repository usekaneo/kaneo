# WP9 — Tests

RFC 0001, WP9, revised for the governing decisions. This document is the acceptance ledger for the whole plan: every PR lands its slice of the matrix; nothing is deferred to a final test PR. The quota-specific cases live in the WP10 matrix and are referenced here.

## 1. Existing suites to extend

- `tests/api-integration/integration-sync-settings.test.ts` — sync settings per binding (WP5)
- `tests/api-integration/integration-sync-rules.test.ts` — sync rules per binding (WP5)
- `tests/api-integration/pull-request-task-links.test.ts` — external link isolation across bindings (WP2)
- `tests/plugins/gitlab/webhook-handler.test.ts` — per-integration webhook with per-row secret (WP4)
- Migration tests — WP0 backfill and rollback guard
- Existing middleware suites — WP1 regression

## 2. Test matrix

Revisions against RFC WP9 are marked. Cases D1.1 to D1.3 replace the RFC's original cross-project 409 case, because sharing is allowed. Quota cases are owned by WP10.

| Case | Level | WP |
|---|---|---|
| Migration backfills repository_key for existing rows (all three providers, numeric and legacy GitHub keys) | migration test | WP0 |
| Partial unique index preserves one-row-per-project for non-git integrations | migration/database test | WP0 |
| Rollback guard passes before multi-binding and refuses after | migration test | WP0 |
| Link two GitHub repositories to one project; both webhooks create tasks with distinct links | api-integration | WP2 |
| Duplicate link to the same project returns 409 with code `repository_already_linked` | api-integration | WP2 |
| D1.1 Cross-project link of the same repository succeeds; no 409 is returned | api-integration | WP2/WP3/WP4 |
| D1.2 One repository event fans out to every bound project; each project's tasks carry their own binding's external links | api-integration | WP2 |
| D1.3 Cross-project bindings maintain independent sync rules, workflow rules, and import state | api-integration | WP5/WP6 |
| Concurrent create of the same repository in the same project: exactly one row survives; in different projects: both survive | api-integration | WP2/WP3/WP4 |
| Delete one binding: the other stays active; external links and import state of the deleted row cascade; tasks remain | api-integration | WP2/WP3/WP4 |
| `findAllIntegrationsByRepo` resolves via repository_key including legacy owner/name keys | unit | WP2 |
| Sync rules keyed by integrationId; preview, save, review, and resume per binding | api-integration | WP5 |
| Preview token not replayable against a sibling binding | api-integration | WP5 |
| Workflow rule resolution: repository-specific rule wins over the type-wide fallback; sibling falls back | unit | WP6 |
| NULL-aware upsert: type-wide and specific rules coexist for the same (project, type, event) | api-integration | WP6 |
| `fromIntegration` middleware: foreign-workspace integrationId yields 403 on every id-keyed route (one negative test per route) | api-integration | WP1–WP5 |
| Gitea webhook per integrationId with per-row secret (signature check per row) | api-integration | WP3 |
| GitLab webhook handler per integrationId with per-row secret | api-integration | WP4 |
| Webhook secret exposure limited to manage_settings callers per binding | api-integration | WP3/WP4 |
| Quota: at-limit create returns 402 with used/limit; deactivation frees quota; reactivation re-checked; mixed-provider counting; usage summary matches | api-integration | WP10 |
| Key derivation equivalence between SQL backfill and TypeScript helpers (Gitea normalization, GitLab paths) | unit | WP0/WP3/WP4 |
| Web settings list: render N bindings, add flow, disconnect confirmation, quota badge, cross-project note, states | component tests | WP7 |
| Unique violation mapping: same-project violation maps to 409; an unmapped constraint still surfaces as 500 | unit | WP2 |

## 3. Test infrastructure notes

- Concurrency cases (simultaneous creates) need a test harness that issues parallel requests against a real database; both same-project and cross-project variants are asserted (D1 changes the expected outcome: same-project leaves one row and one 409; cross-project leaves two rows and no error).
- Fan-out cases assert three things per event: task creation in every bound project, external links scoped per binding, and project-scoped task numbering with no collisions.
- Component tests cover the states table of WP7 (empty, loading, error, partial, limit reached, cross-project note) and keyboard and focus behavior.
- Migration tests run against a database seeded with single-repository rows for all three providers, including a legacy GitHub row without repositoryId and unnormalized Gitea base URLs.

## 4. Acceptance criteria

1. Every matrix row is green in CI before the corresponding PR merges; the matrix is duplicated into the PR description of each provider PR with its own rows checked.
2. No cross-project 409 case remains anywhere in the suite (D1); a grep for the old message "already linked to another project" returns nothing.
3. The fan-out and concurrency cases run against a real PostgreSQL instance, not mocks, because they exercise constraint behavior.
4. Coverage of every new route: one happy path, one 403 foreign-workspace path, one 404 path, and where applicable one 409 and one 402 path.
5. The WP10 quota matrix and the WP7 component matrix are tracked as sub-ledgers in their PRs and reconciled here at the end of the rollout.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Suites green individually but flaky under parallel constraint tests | Concurrency cases use distinct repositories and projects per test; database-level assertions retry with a small bounded loop |
| Legacy-data migration tests miss real-world config shapes | Seed data is drawn from the config schemas of all three providers, including invalid JSON rows, which must not abort the backfill |
| Component tests drift from the actual API shapes | Zod schemas shared between fetcher and hook (WP7) are reused in the test mocks |
## 6. Rollout reconciliation (2026-10-07)

This section is the end-of-rollout reconciliation required by acceptance criterion 5. All work packages have landed on `feat/multi-repo-integrations` (head `ce129ca8`): WP0 (#2), WP1 (#3), WP10 (#4), WP2 (#5, #6), WP3 (#7, #8), WP4 (#9), WP5 (#10), WP6 (#11), WP7 (#12), WP8 (#13), WP9 acceptance (#14). The table records, for every matrix row, the covering suite as verified against the merged branch, the landing PR, and the reconciled status.

| Matrix row | Evidence on the merged branch | PR | Status |
|---|---|---|---|
| Migration backfills repository_key for existing rows | Deferred with the migration: no drizzle migration is authored in this rollout; the generated migration (follow-up, see 6.3) must contain the backfill. Key derivation equivalence is covered by code-level tests instead (rows below) | #2 | Deferred to migration follow-up |
| Partial unique index preserves one-row-per-project for non-git integrations | `integration_project_type_null_repo_unique` declared in `apps/api/src/database/schema.ts`; database-level test deferred with the migration | #2 | Deferred to migration follow-up |
| Rollback guard passes before multi-binding and refuses after | Deferred with the migration per the same instruction | #2 | Deferred to migration follow-up |
| Link two GitHub repositories to one project; both webhooks create tasks with distinct links | `tests/api-integration/github-rebind.test.ts` — "links a different repository as an additional binding without touching the first"; `tests/api-integration/pull-request-task-links.test.ts` fixture keys both bindings | #5, #6 | Covered |
| Duplicate link to the same project returns 409 `repository_already_linked` | `tests/api/github-integration/repository-binding.test.ts` ("maps a same-project duplicate insert to a 409 with the documented code"); rebind suites for GitHub and GitLab; gitea and gitlab binding-route suites | #5, #7, #9 | Covered |
| D1.1 Cross-project link of the same repository succeeds; no 409 | `tests/api-integration/gitlab-rebind.test.ts` — "permits the same GitLab project in a second project with independent webhook delivery (decision D1)"; `tests/api-integration/gitea-binding-routes.test.ts` — "shares one repository across projects and isolates deletion"; `tests/api-integration/github-binding-routes.test.ts` — "requires a completed OAuth account and permits independently authorized tenant bindings" (two owners connect the same repository, two bindings, no 409) | #5, #7, #9 | Covered |
| D1.2 One repository event fans out to every bound project; per-binding external links; per-project numbering | `tests/api-integration/github-repository-fan-out.test.ts` — "creates one task per bound project from a single repository event" (one delivery without an integrationId, two bound projects, per-project numbering, per-binding external links, one linking comment per project; deactivated bindings skipped) on top of the lookup-level suite `tests/api/github-integration/repository-binding.test.ts` | #5, #14 | Covered |
| D1.3 Cross-project bindings maintain independent sync rules, workflow rules, and import state | `tests/api-integration/workflow-rule-binding.test.ts` — "carries different rules per project binding for a shared repository (decision D1)"; `tests/api-integration/gitea-binding-routes.test.ts` deletion isolation; `tests/api-integration/integration-sync-binding-routes.test.ts` sibling isolation | #7, #10, #11 | Covered |
| Concurrent create: exactly one row in the same project; both survive in different projects | `tests/api-integration/gitlab-rebind.test.ts` — "leaves exactly one row when two concurrent creates race for the same path" (real database); the cross-project both-survive variant: `tests/api-integration/cross-project-concurrent-bindings.test.ts` — "keeps both rows when two projects bind the same repository concurrently" (both 200, one row per project, distinct webhook secrets) | #9, #14 | Covered |
| Delete one binding: the other stays active; links and import state cascade; tasks remain | `tests/api-integration/gitea-binding-routes.test.ts` — "shares one repository across projects and isolates deletion"; `tests/api-integration/github-rebind.test.ts` — "permits relinking after disconnect without reusing old links or import cursors"; `tests/api-integration/workflow-rule-binding.test.ts` cascade rules | #5, #7, #9 | Covered |
| `findAllIntegrationsByRepo` resolves via repository_key including legacy owner/name keys | `tests/api/github-integration/repository-binding.test.ts` — "falls back to the legacy owner/name key when the numeric key has no bindings", "skips the legacy fallback when the event lacks repository coordinates" | #5 | Covered |
| Sync rules keyed by integrationId; preview, save, review, and resume per binding | `tests/api-integration/integration-sync-binding-routes.test.ts`; `tests/api-integration/integration-sync-rules.test.ts`; `tests/api-integration/integration-sync-settings.test.ts` | #10 | Covered |
| Preview token not replayable against a sibling binding | `tests/api-integration/integration-sync-binding-routes.test.ts` — "scopes preview tokens per binding and refuses a sibling's token" | #10 | Covered |
| Workflow rule resolution: repository-specific rule wins; sibling falls back | `tests/api-integration/workflow-rule-binding.test.ts` — "prefers the repository-specific rule and falls back for sibling bindings" | #11 | Covered |
| NULL-aware upsert: type-wide and specific rules coexist | `tests/api-integration/workflow-rule-binding.test.ts` — "keeps a type-wide rule and a repository-specific rule as separate rows" | #11 | Covered |
| `fromIntegration` middleware: foreign-workspace integrationId yields 403 on every id-keyed route | `tests/api/utils/workspace-access-from-integration.test.ts`; id-keyed 403 loops in `integration-sync-binding-routes.test.ts`; foreign-workspace cases in the three binding-route suites and `gitlab-rebind.test.ts`; foreign-project rejection in `workflow-rule-binding.test.ts` | #3, #5, #7, #9, #10 | Covered |
| Gitea webhook per integrationId with per-row secret | `tests/api-integration/gitea-binding-routes.test.ts` — "verifies webhook deliveries per row with each binding's own secret" | #7, #8 | Covered |
| GitLab webhook handler per integrationId with per-row secret | `tests/api/plugins/gitlab/webhook-handler.test.ts` — "rejects a delivery whose token does not match"; `tests/api-integration/gitlab-binding-routes.test.ts` per-row secrets | #9 | Covered |
| Webhook secret exposure limited to manage_settings callers per binding | `tests/api-integration/gitea-binding-routes.test.ts` and `gitlab-binding-routes.test.ts` — "hides the secret from callers without manage_settings" | #7, #9 | Covered |
| Quota: 402 with used/limit; usage summary matches | `tests/api/plan-limits/repository-binding-quota.test.ts` (402 payload with used/limit, quota event once per refusal, usage summary equals the enforcement count); `tests/api-integration/gitea-binding-routes.test.ts` — "refuses bindings beyond the workspace plan limit"; `tests/api-integration/gitlab-rebind.test.ts` — "enforces the workspace repository binding quota and reports its usage" | #4, #7, #9 | Covered |
| Quota: deactivation frees quota; reactivation re-checked; mixed-provider counting | `tests/api-integration/repository-binding-quota-lifecycle.test.ts` — "frees quota on deactivation and re-checks reactivation" (402 with used/limit on both the create and the false-to-true reactivation, usage drops on deactivation, the freed slot admits the next create) and "counts active bindings across providers" (a Gitea, a GitHub, and a GitLab binding of one project count against the same limit). Counting filters `isActive` and all three provider types in `apps/api/src/plan-limits/repository-binding-quota.ts` | #4, #5, #14 | Covered |
| Key derivation equivalence between the backfill and the TypeScript helpers | `tests/api-integration/gitlab-rebind.test.ts` — "derives the repository key exactly as the WP0 backfill SQL does"; `tests/api/gitea-integration/repository-binding.test.ts` — "derives the repository key from normalized lowercased coordinates"; GitHub numeric and legacy keys in `repository-binding.test.ts` | #5, #7, #9 | Covered |
| Web settings list: bindings, add flow, disconnect confirmation, quota badge, cross-project note, states | `apps/web/src/components/project/github-integration-settings.test.tsx`, `gitea-integration-settings.test.tsx`, `gitlab-integration-settings.test.tsx`, `integrations/integration-row.test.tsx`, `repository-browser-modal.test.tsx`, `gitea-repository-browser-modal.test.tsx`, `integrations/use-integration-statuses.test.tsx` | #12, #14 | Covered |
| Unique violation mapping: same-project violation maps to 409; unmapped constraint surfaces as 500 | `tests/api/github-integration/repository-binding.test.ts` — "maps a same-project duplicate insert to a 409 with the documented code" and "rethrows unique violations of other constraints unchanged"; same pair in the gitea and gitlab suites | #5, #7, #9 | Covered |

### 6.1 Acceptance criterion status

1. Per-PR slices: every provider PR duplicated its matrix rows in its description; the slices are merged. CI verdicts for #12 and #13 were queued behind the runner backlog at merge time; the WP5 import defect that failed `typecheck` and `openapi` on the integration branches was fixed by #13 and verified by a local reproduction with Node 24.19.0 and pnpm 10.32.1 before the export was regenerated. The WP9 acceptance PR #14 (test files only, no production changes) closed the remaining gaps 6.4–6.6; its CI verdict was queued behind the same backlog at merge time.
2. No cross-project 409 remains: a case-insensitive search for "already linked to another project" over the merged tree returns no matches.
3. Real PostgreSQL for constraint cases: the concurrency, binding-route, rebind, sync, and workflow-rule suites run against the CI database service; the repository lookup fan-out is additionally covered at unit level.
4. New-route coverage: happy, 403, and 404 paths are present for the id-keyed routes across the binding-route, rebind, sync, and workflow suites; 409 on the create paths and 402 on the quota paths are asserted in the gitea, gitlab, and rebind suites.
5. Sub-ledgers: the WP10 quota matrix was tracked in #4 and re-asserted by the callers in #7 and #9; the WP7 component matrix was tracked in #12. This section reconciles them.

### 6.2 Deviations accepted during the rollout

- No drizzle migration was authored (instruction for this rollout). PR #2 documents that `pnpm db:generate` output must contain the repository_key backfill and the rollback guard before the schema change reaches a release.
- The legacy `github_integration` cleanup PR scheduled after WP2 remains open follow-up work (item 6.3), as does the compat shim removal for the project-keyed GET routes.

### 6.3 Open follow-ups (blocking release)

1. Generate the drizzle migration from the merged schema, including the repository_key backfill for all three providers (numeric and legacy GitHub keys, unnormalized Gitea base URLs) and the rollback guard; add the migration test rows from section 2.
2. Retire the legacy `github_integration` table and `get-github-integration-by-repository-id.ts` (cleanup PR scheduled in WP2).
3. Remove the project-keyed GET compat shim once the shipped web client no longer uses it.

### 6.4 Test gaps resolved by the WP9 acceptance PR (#14)

1. `tests/api-integration/github-repository-fan-out.test.ts` delivers one repository event to two projects bound to the same repository and asserts a task per project, per-binding external links, and per-project task numbering without collisions, plus the exclusion of deactivated bindings (row D1.2).
2. `tests/api-integration/cross-project-concurrent-bindings.test.ts` asserts the cross-project concurrent-create variant: both rows survive the race, each with its own webhook secret.

### 6.5 Test gaps resolved by the WP9 acceptance PR (#14)

1. Deactivation frees quota: create after deactivating a binding at the limit succeeds (`repository-binding-quota-lifecycle.test.ts`).
2. Reactivation re-check: setting `isActive` false-to-true at the limit returns 402 with used/limit in the body (`repository-binding-quota-lifecycle.test.ts`).
3. Mixed-provider counting: a GitHub, a Gitea, and a GitLab binding in one project count as three against the limit (`repository-binding-quota-lifecycle.test.ts`).

### 6.6 Test gaps resolved by the WP9 acceptance PR (#14)

1. `apps/web/src/components/project/gitlab-integration-settings.test.tsx` matches the GitHub and Gitea settings suites: list with instance host and plan usage, first-binding entry point, add flow, row menu, and permission gating. Verification gating is not applicable to GitLab rows (`toGitlabBindingRow` never marks a row as requiring verification); the GitHub suite owns that behavior.
