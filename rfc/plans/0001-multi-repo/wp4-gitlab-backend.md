# WP4 — GitLab Backend

RFC 0001, WP4. Same re-keying as WP2 and WP3 in `apps/api/src/gitlab-integration/` and `apps/api/src/plugins/gitlab/`. Governing decisions: D1 (cross-project sharing allowed for GitLab projects as well) and D2 (quota wired from WP10).

## 1. Objective

Insert one integration row per GitLab project, key the surface by integrationId, annotate listed projects with linked state, and key issue import by integrationId, using the GitLab-specific repository identity (base URL plus full project path).

## 2. Repository identity

GitLab addresses repositories by namespaced project path (for example `group/subgroup/app`), not owner/name. The derived identity columns are therefore:

- `repositoryKey = "gitlab:" + normalizedBaseUrl + "/" + projectPath.toLowerCase()`
- `repositoryName = <final path segment>` (display convenience only)
- `repositoryOwner = <top-level group>` (display convenience only)
- `baseUrl = normalizedBaseUrl`
- `repositoryId` remains NULL for GitLab (no numeric id is part of the current config contract; do not invent a remote lookup in this PR)

The normalization of the base URL must reuse the existing GitLab helper (`normalizeGitlabBaseUrl` or equivalent in `plugins/gitlab/utils/gitlab-api.ts`); the key derivation in TypeScript must produce byte-identical keys to the WP0 SQL backfill for existing rows, and a unit test asserts this equivalence.

## 3. Controllers (`apps/api/src/gitlab-integration/controllers/`)

### 3.1 `create-gitlab-integration.ts`

1. Keep the existing verification flow (`verifyGitlabAccess`, `tokenTypeOf`, project existence check).
2. Derive identity per section 2.
3. Call `assertRepositoryBindingQuota(projectId, workspaceId)` (WP10) before insert.
4. Insert a new row; keep the config JSON contract (token, project path, sync rules, webhook secret) unchanged in shape.
5. Map the `integration_project_type_repo_unique` violation via the shared helper (WP2) to 409 `repository_already_linked`.
6. Per D1, no cross-project check exists.

### 3.2 Get, update, delete

Same re-keying as WP2/WP3: `listGitlabIntegrations(projectId)` array (with usage summary per WP10), `getGitlabIntegration(integrationId)`, `deleteGitlabIntegration(integrationId)`, update by id with the quota check on reactivation. The per-integration webhook secret exposure rules follow the WP3 pattern (`manage_settings` only).

### 3.3 `list-gitlab-projects.ts`

Annotate each listed project with `linkedTo` using a server-side Map keyed by repository key. Same-project annotation blocks selection with an inline reason; cross-project annotation is informational (D1).

### 3.4 `import-gitlab-issues.ts`

Accept `integrationId`; validate the integration belongs to the addressed project; import state is per binding.

## 4. Webhooks

The GitLab webhook endpoint is already per-integration (`/webhook/:integrationId` route visible in `apps/api/src/gitlab-integration/index.ts`, handled by `handleGitlabWebhookRequest`), each row carrying its own secret. With cross-project sharing, one GitLab repository will have two webhook registrations pointing at two distinct integration routes. The PR verifies that webhook registration (manual or automatic) is per binding and does not interfere between bindings, mirroring the WP3 review checkpoint.

## 5. Routes

| Operation | Current | Target |
|---|---|---|
| Link | POST (current create path) | Unchanged path, new semantics: adds one binding |
| List | — | GET `/project/{projectId}/integrations` |
| Detail | GET project-keyed | GET `/integration/{integrationId}` (compat shim: first binding) |
| Update | PATCH project-keyed | PATCH `/integration/{integrationId}` |
| Delete | DELETE project-keyed | DELETE `/integration/{integrationId}` |
| Import | POST import path | Body gains `integrationId` |
| Webhook | POST `/webhook/:integrationId` | Unchanged |

Access composition mirrors WP2/WP3: `fromProject` for list and link; `fromIntegration` plus `manage_settings` for id-keyed mutations.

## 6. OpenAPI

Array schema for the list route plus the WP10 usage summary; single-object schemas for id-keyed routes; documented 409 `repository_already_linked`, 402 `binding_limit_exceeded`, 403, 404. `openapi:export` refresh lands in this PR.

## 7. Acceptance criteria

1. Two different GitLab projects (same or different instances) can be linked to one project; per-row webhook secrets.
2. Duplicate link of the same GitLab project to the same project returns 409; concurrent creates leave exactly one row.
3. Cross-project link succeeds (D1); both webhook routes deliver independently.
4. Key derivation matches the WP0 backfill byte for byte (unit-asserted for representative paths with nested subgroups, uppercase characters, and trailing-slash base URLs).
5. Quota behavior matches the WP10 matrix for the gitlab type.
6. Id-keyed routes reject foreign-workspace ids with 403.

## 8. Test plan

| Case | Level |
|---|---|
| Link two GitLab projects to one project | api-integration |
| Duplicate same-project link returns 409 | api-integration |
| Cross-project link succeeds; both webhook routes deliver | api-integration (D1) |
| Webhook handler per integrationId with per-row secret (extend `plugins/gitlab/webhook-handler.test.ts`) | api-integration |
| Key derivation equivalence with SQL backfill | unit |
| Foreign-workspace integrationId yields 403 | api-integration |
| Quota refusal and usage summary for gitlab bindings | api-integration |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Key derivation drift between SQL backfill and TypeScript | Equivalence unit test is an acceptance criterion |
| Path casing (GitLab paths are case-insensitive on lookup but stored canonically) | Lowercase the full path in the key; document that display strings keep original casing |
| Webhook registration interference between shared bindings | Per-binding registration verified in review; sequencing test in the matrix |