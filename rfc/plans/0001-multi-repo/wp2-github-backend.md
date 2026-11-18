# WP2 — GitHub Backend

RFC 0001, WP2. Governing decisions: D1 (cross-project sharing allowed; no instance-wide unique, no cross-project 409) and D2 (quota check wired from WP10). This package is the review template for WP3 and WP4, which are structurally identical.

## 1. Objective

Re-key the GitHub integration surface from "the project's single GitHub integration" to "integrations by id", make create insert one row per repository, replace the full-table JSON scan in webhook routing with the indexed repository key lookup, and wire the quota guard.

## 2. Controllers (`apps/api/src/github-integration/controllers/`)

### 2.1 `create-github-integration.ts`

Verified current behavior: the controller finds the single existing row for (projectId, "github"), and if a different repository is requested it throws 409 (the disconnect-before-switching rule).

Target behavior:

1. Keep `verifyRepositoryOwner(userId, repositoryOwner, repositoryName)` unchanged; it returns the binding with `installationId` and `repositoryId`.
2. Call `assertRepositoryBindingQuota(projectId, workspaceId)` (WP10) before insert. 402 propagates unchanged.
3. Derive identity: `repositoryKey = "github:" + String(binding.repositoryId)`; populate `repositoryOwner`, `repositoryName` (as returned by GitHub), `repositoryId`.
4. Insert a new row. The config JSON keeps carrying all provider-specific settings (installation id, repository coordinates, sync rules, webhook secret if any), identical in shape to today.
5. Map unique violations: catch the database error for constraint `integration_project_type_repo_unique` and return 409 with code `repository_already_linked` and message "Repository is already linked to this project". Per D1 there is deliberately no check against other projects.
6. Delete the find-existing-and-update branch and the same-repository 409 logic entirely.

Shared helper for all three providers (place in `apps/api/src/integrations/map-unique-violation.ts`): given a caught insert error, recognize the unique violation, identify the constraint name, and throw the matching HTTPException. Constraint names other than `integration_project_type_repo_unique` re-throw unchanged so that a genuine 500 remains a 500 (RFC risk table, row 1).

```ts
// Sketch of the insert
const [created] = await db
  .insert(integrationTable)
  .values({
    projectId,
    type: "github",
    config: JSON.stringify({ ...defaultGitHubConfig(), ...binding-derived fields }),
    repositoryKey: `github:${binding.repositoryId}`,
    repositoryOwner: binding.repositoryOwner,
    repositoryName: binding.repositoryName,
    repositoryId: binding.repositoryId,
    isActive: true,
  })
  .returning();
```

### 2.2 `get-github-integration.ts`

- Add `listGithubIntegrations(projectId)`: `findMany` where `projectId` and `type = "github"`, ordered by `createdAt`. Each row is enriched with:
  - Verification state: `hasVerifiedGitHubBinding(config)`, exposing a `needsVerification` boolean for the UI chip.
  - Import progress: when a `github_import` row exists for the integration id, its state (progress counters, running flag) is attached; absent otherwise.
- Keep `getGithubIntegration(integrationId)`: single lookup by primary key, same enrichment.
- Compat shim (RFC section 8): the old project-keyed GET temporarily returns the first binding (lowest createdAt) until the new web client ships; it is removed in the cleanup PR.

### 2.3 `delete-github-integration.ts`

Delete by `integrationId` (primary key). Cascades remove the row's `external_link` and `github_import` rows automatically; tasks created from its issues remain in the project. The disconnect confirmation copy in WP7 states exactly this.

### 2.4 `import-issues.ts`

Accept `integrationId` in the request body alongside the existing fields; resolve the integration by id and validate it belongs to `projectId` when a projectId is also provided. The resumable import state in `github_import` is already keyed by integration id, so no change to the import state machine is required.

### 2.5 `verify-github-installation.ts` and `list-user-repositories.ts`

Annotate each listed repository with its linked state, resolved with one query:

```ts
const links = await db.query.integrationTable.findMany({
  where: and(eq(integrationTable.type, "github"), inArray(integrationTable.repositoryKey, keys)),
});
const linksByKey = new Map(links.map((l) => [l.repositoryKey, l]));
```

Per repository, return `linkedTo: { integrationId, projectId, projectName } | null` — server-side Map keyed by repository key, never repeated `find()` over the array. Per D1 the annotation is informational for cross-project links ("already linked in another project") and only the same-project annotation blocks selection in the picker UI.

## 3. Plugin webhook routing (`apps/api/src/plugins/github/services/task-service.ts`)

Replace the current implementation (loads every github row, parses each config JSON, filters in memory) with the indexed lookup from RFC section 4.1/WP2:

```ts
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
```

Notes:

- With D1, the result set can now span multiple projects; every webhook handler already iterates the returned bindings, so one repository event creates tasks in every bound project. This is the intended sharing behavior.
- Legacy support: for events arriving from repositories whose bindings still carry an owner/name key (unverified legacy rows), keep a fallback lookup on the legacy key form `github:<owner>/<name>` lowercased when the numeric-key query returns nothing. The filter via `hasVerifiedGitHubBinding` already excludes unverifiable legacy rows from task creation, mirroring today's behavior.
- This change removes the full-table JSON scan and improves webhook latency on large instances.

## 4. Routes (`apps/api/src/github-integration/index.ts`)

| Operation | Current | Target |
|---|---|---|
| Link | POST `/project/{projectId}` | Unchanged path, new semantics: adds one binding per call |
| List | — | GET `/project/{projectId}/integrations` |
| Detail | GET `/project/{projectId}` | GET `/integration/{integrationId}` (compat shim on the old path, see 2.2) |
| Update | PATCH `/project/{projectId}` | PATCH `/integration/{integrationId}` |
| Delete | DELETE `/project/{projectId}` | DELETE `/integration/{integrationId}` |
| Import | POST `/import-issues` | Body gains `integrationId` |
| Webhook | POST `/webhook` | Unchanged |

Access composition:

- List and link routes keep `workspaceAccess.fromProject("projectId")` plus `requireWorkspacePermission({ workspace: ["manage_settings"] })` for mutations (the existing `manageAccess` array in the route file).
- Detail, update, delete, and import-by-id routes compose `workspaceAccess.fromIntegration("integrationId")` (WP1) plus the same permission requirement.
- The PATCH route keeps its optimistic-concurrency config compare; the compare now reads the addressed row by id.

### OpenAPI (`github-integration/response.ts` and schema files)

- List route: array response schema; add the `usage` summary object (WP10) to the list response.
- Detail, update, delete, import: single-object schemas for the id-keyed routes.
- Add documented error responses: 409 `repository_already_linked`, 402 `binding_limit_exceeded`, 403, 404.
- Run `openapi:export` refresh in this PR; the MCP review is WP8.

## 5. Quota wiring (WP10)

- Create controller calls `assertRepositoryBindingQuota` before insert (see 2.1).
- Update controller calls it when `isActive` transitions false to true.
- List endpoint returns `usage: { used, limit }` resolved by `resolveRepositoryBindingLimits`.

## 6. Acceptance criteria

1. Two different GitHub repositories can be linked to one project; both rows exist and both webhook streams create tasks with distinct external links.
2. Linking the same repository twice to the same project returns 409 with code `repository_already_linked` (constraint-mapped, not a raw 500).
3. Linking a repository that is already linked to another project succeeds (D1); the annotation endpoint reports both bindings.
4. A repository event fans out to every bound project; each project's tasks carry external links scoped to their own binding.
5. Webhook routing performs an indexed lookup; no code path loads all github rows.
6. Deleting one binding leaves the other active; the deleted row's external links and import state cascade away; tasks remain.
7. A foreign-workspace integrationId on any id-keyed route yields 403 (WP1 wired here).
8. At the plan limit, create returns 402; below the limit it succeeds; the list response usage matches.
9. Legacy unverified bindings are skipped by task creation exactly as today.

## 7. Test plan

| Case | Level |
|---|---|
| Link two github repositories to one project; both webhooks create tasks with distinct links | api-integration |
| Duplicate link to the same project returns 409 with mapped code | api-integration |
| Cross-project link of the same repository succeeds; webhook fan-out creates tasks in both projects | api-integration (D1) |
| Concurrent create of the same repository in the same project: exactly one row survives | api-integration |
| `findAllIntegrationsByRepo` resolves via repository_key including legacy owner/name keys | unit |
| Foreign-workspace integrationId yields 403 on detail/update/delete/import | api-integration |
| Quota refusal and usage summary | api-integration (WP10 matrix) |
| Import keyed by integrationId resumes per binding | api-integration |

## 8. Follow-up cleanup PR

After this PR merges and the new web client ships: retire the legacy `github_integration` table and `get-github-integration-by-repository-id.ts`, and remove the project-keyed GET compat shim. Tracked as the final cleanup PR in the revised slicing (depends on PR4 and the WP7 client release).

## 9. Risks

| Risk | Mitigation |
|---|---|
| Unique violation surfaces as 500 | `map-unique-violation.ts` shared helper; test both mapped and unmapped violations |
| Legacy GitHub configs lack repositoryId | Legacy owner/name key in `repository_key` (WP0 backfill); numeric key adopted on re-verification through the existing `hasVerifiedGitHubBinding` flow |
| Compat shim masks missing list wiring in the client | Shim has a removal issue filed against the WP7 PR |
| Fan-out creates duplicate task numbers across projects | Task numbering is project-scoped (`claimTaskNumber`), so no collision is possible by design |