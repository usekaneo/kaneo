# WP3 — Gitea Backend

RFC 0001, WP3. Mirror of WP2 with Gitea specifics. Governing decisions: D1 (the current cross-project prohibition is removed; the O(n) JSON conflict scan is deleted with nothing replacing it) and D2 (quota wired from WP10).

## 1. Objective

Insert one integration row per Gitea repository, generate a fresh webhook secret per row, re-key get/update/delete to integrationId, annotate listed repositories with linked state, and key issue import by integrationId.

## 2. Controllers (`apps/api/src/gitea-integration/controllers/`)

### 2.1 `create-gitea-integration.ts`

Verified current behavior (two problematic blocks):

1. Update-in-place: finds the single existing (projectId, "gitea") row and reuses its webhook secret and config.
2. Cross-project scan: loads every gitea row in the instance (`findMany` on type), parses each config JSON, and throws 409 "already linked to another project" on a match. This is an O(n) scan with a concurrency race: two concurrent creates can both pass it.

Target behavior:

1. Unchanged preconditions: project existence (404), `normalizeGiteaBaseUrl(baseUrl)`, `resolveVerificationToken`, `verifyGiteaToken`, `client.getRepo(repositoryOwner, repositoryName)` with GiteaApiError mapping.
2. Derive identity: `repositoryKey = "gitea:" + normalizedBase + "/" + owner.toLowerCase() + "/" + name.toLowerCase()`; populate `repositoryOwner`, `repositoryName`, `baseUrl = normalizedBase`.
3. Call `assertRepositoryBindingQuota(projectId, workspaceId)` (WP10) before insert.
4. Insert a new row with a fresh `webhookSecret` (`randomBytes(24).toString("hex")`) — one secret per binding, never copied from an existing row.
5. Delete both current blocks: the update-in-place branch and the entire `allGitea` cross-project scan. Per D1, cross-project duplicates are valid rows; per WP0, same-project duplicates are rejected by `integration_project_type_repo_unique`, which also closes the concurrency race the in-memory scan left open.
6. Map the unique violation via the shared helper (WP2, `apps/api/src/integrations/map-unique-violation.ts`) to 409 `repository_already_linked`, message "Repository is already linked to this project".

### 2.2 Get, update, delete

Same re-keying as WP2:

- `listGiteaIntegrations(projectId)`: array with per-row enrichment (active state; no verification equivalent to GitHub exists, so the row's `isActive` drives the status chip; import progress when a gitea import run exists).
- `getGiteaIntegration(integrationId)`: single lookup by primary key.
- `deleteGiteaIntegration(integrationId)`: delete by id; cascades clean external links and import state.
- Update by id keeps the optimistic-concurrency config compare if present in the current update flow, and calls the quota helper when reactivating.

Webhook secret exposure: the secret is returned only to callers with `manage_settings`, exactly as today; it is per row now, so each project owner sees only their own binding's secret.

### 2.3 `list-gitea-repositories.ts`

Annotate each listed repository with `linkedTo` resolved by a server-side Map keyed by `repository_key` (same-project and cross-project annotations; cross-project is informational only per D1). When the picker shows a repository already linked to the addressed project, selection is blocked with an inline reason; cross-project links remain selectable.

### 2.4 `import-gitea-issues.ts`

Accept `integrationId`; resolve and validate the integration belongs to the addressed project. Import state is per binding.

### 2.5 Webhook registration note

The Gitea webhook endpoint is per integration (`/webhook/:integrationId`), each row carrying its own secret. With cross-project sharing, the same Gitea repository will typically have two webhook registrations on the Gitea side (one per binding, distinct secrets). If the product auto-registers webhooks on create, verify the registration call is idempotent per binding and does not delete another binding's hook; document the manual registration step otherwise. This must be confirmed against the actual registration code in the PR and is the main review checkpoint for this package.

## 3. Routes (`apps/api/src/gitea-integration/index.ts`)

| Operation | Current | Target |
|---|---|---|
| Link | POST `/project/{projectId}` | Unchanged path, new semantics: adds one binding |
| List | — | GET `/project/{projectId}/integrations` |
| Detail | GET `/project/{projectId}` | GET `/integration/{integrationId}` (compat shim: first binding, until the new client ships) |
| Update | PATCH `/project/{projectId}` | PATCH `/integration/{integrationId}` |
| Delete | DELETE `/project/{projectId}` | DELETE `/integration/{integrationId}` |
| Import | POST `/import` (current shape) | Body gains `integrationId` |
| Webhook | POST `/webhook/:integrationId` | Unchanged |

Access composition mirrors WP2: list and link keep `fromProject`; id-keyed routes compose `workspaceAccess.fromIntegration("integrationId")` plus `manage_settings` for mutations.

## 4. OpenAPI

Array schema for the list route plus the WP10 `usage` summary; single-object schemas for id-keyed routes; documented 409 `repository_already_linked`, 402 `binding_limit_exceeded`, 403, 404. `openapi:export` refresh lands in this PR.

## 5. Acceptance criteria

1. Two different Gitea repositories (same or different instances) can be linked to one project; each row has its own webhook secret.
2. Duplicate link of the same repository to the same project returns 409 `repository_already_linked`, including under concurrent creates (the database constraint decides).
3. Linking a repository already bound to another project succeeds (D1); both bindings receive webhook deliveries on their own routes with their own secrets.
4. No code path scans all gitea rows.
5. Deletion of one binding leaves the other fully functional, including its webhook route.
6. The webhook secret of binding A is not readable through binding B's detail route.
7. Quota behavior matches the WP10 matrix for the gitea type.
8. Id-keyed routes reject foreign-workspace ids with 403.

## 6. Test plan

| Case | Level |
|---|---|
| Link two gitea repositories to one project; per-row secrets differ | api-integration |
| Duplicate same-project link returns 409, concurrent creates leave exactly one row | api-integration |
| Cross-project link succeeds; both webhook routes deliver with their own secrets | api-integration (D1) |
| Gitea webhook per integrationId with per-row secret (signature check per row) | api-integration |
| Foreign-workspace integrationId yields 403 on id-keyed routes | api-integration |
| Secret exposure limited to manage_settings callers | api-integration |
| Quota refusal and usage summary for gitea bindings | api-integration |
| Import keyed by integrationId | api-integration |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Webhook double-registration or cross-deletion on shared repositories | Confirm registration code path per binding; test create-share-delete sequencing; review checkpoint named in section 2.5 |
| Unique violation surfaces as 500 | Shared mapping helper from WP2; tested |
| Compat shim masks client migration | Removal tracked with WP7 |