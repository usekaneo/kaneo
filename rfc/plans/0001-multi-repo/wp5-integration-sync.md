# WP5 — Integration Sync

RFC 0001, WP5. Re-keys the integration-sync surface from (projectId, provider) to integrationId. Governing decisions: D1 has no additional impact here (rules were always per row); D2 does not apply (sync operations are not quota-relevant).

## 1. Objective

Every sync route and controller operates on one binding identified by integrationId. Rules, preview tokens, paused-link review, and resume remain scoped per row, which is the correct granularity: each repository gets its own label mappings and outgoing rules.

## 2. Current state (verified)

`apps/api/src/integration-sync/controllers/get-integration.ts` exposes:

```ts
export async function getSyncIntegration(projectId: string, provider: string, database: IntegrationDatabase = db) {
  const integration = await database.query.integrationTable.findFirst({
    where: and(eq(integrationTable.projectId, projectId), eq(integrationTable.type, provider)),
    with: { project: true },
  });
  if (!integration) throw new HTTPException(404, { message: "Integration not found" });
  if (!readSyncRules(integration.config))
    throw new HTTPException(409, { message: "Invalid sync rules; repair the integration configuration" });
  return integration;
}
```

The one-row-per-project assumption lives in this `findFirst` on (projectId, type). All five routes (get, preview, save-rules, review, resume) and the helpers (`preview-rules.ts`, `save-rules.ts`, `review-resume.ts`, `resume-sync.ts`, `lock-resume-scope.ts`, `authorized-project.ts`) consume this lookup.

## 3. Implementation

### 3.1 Re-key the lookup

```ts
export async function getSyncIntegration(
  integrationId: string,
  database: IntegrationDatabase = db,
) {
  const integration = await database.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
    with: { project: true },
  });
  if (!integration) throw new HTTPException(404, { message: "Integration not found" });
  if (!readSyncRules(integration.config))
    throw new HTTPException(409, { message: "Invalid sync rules; repair the integration configuration" });
  return integration;
}
```

Ownership validation: routes that also carry a projectId in the path or body validate `integration.projectId === projectId` (mismatch is 404, not 403, to avoid confirming the existence of a foreign binding's id). The `authorized-project.ts` helper keeps its role for the cases where authorization is expressed through the project rather than the integration.

### 3.2 Route shape

| Operation | Target route |
|---|---|
| Get binding + rules | GET `/integration-sync/integration/{integrationId}` |
| Preview rules | GET or POST `/integration-sync/integration/{integrationId}/preview` |
| Save rules | PUT/POST `/integration-sync/integration/{integrationId}` (rules payload) |
| Review paused link | POST `/integration-sync/integration/{integrationId}/links/{linkId}/review` |
| Resume paused link | POST `/integration-sync/integration/{integrationId}/links/{linkId}/resume` |

All id-keyed routes compose `workspaceAccess.fromIntegration("integrationId")` (WP1). Read-only preview may use `fromIntegration` without `manage_settings`; save, review, and resume require it, matching the current permission split of the sync routes.

### 3.3 Behavioral notes

- Preview token generation (`preview-rules.ts`) is keyed per binding; tokens no longer collide conceptually between two bindings of the same project.
- Save-rules writes config JSON per row; the optimistic-concurrency compare, if present in the current save flow, now compares the addressed row's config.
- `lock-resume-scope.ts` already locks per integration scope; verify the lock key derives from integrationId and not from (projectId, provider), and change it if necessary.
- Review and resume of paused links operate on the links belonging to the addressed binding only.

### 3.4 Events

`integration.sync_rules_changed` already carries integrationId. Verify the payload includes the projectId as well (for list invalidation) and document that the web client invalidates per integration, not per project: the TanStack Query invalidation key in WP7 is the detail-scoped work key of the addressed binding.

## 4. Files

| File | Change |
|---|---|
| `apps/api/src/integration-sync/controllers/get-integration.ts` | Re-keyed lookup (section 3.1) |
| `apps/api/src/integration-sync/index.ts` | New route paths; fromIntegration wiring; OpenAPI definitions |
| `preview-rules.ts`, `save-rules.ts`, `review-resume.ts`, `resume-sync.ts` | Accept integrationId through the re-keyed lookup; per-row scope |
| `lock-resume-scope.ts` | Verify/adjust lock key to integration scope |
| `authorized-project.ts` | Retained for project-expressed authorization paths |
| `apps/api/src/integration-sync/response.ts` (or route-local schemas) | Updated shapes; documented 403, 404, 409 |

## 5. Compatibility

The old project-keyed sync routes keep working during rollout by resolving the first binding of the project for that provider (same compat shim convention as WP2), and are removed with the cleanup PR once the new client ships. The event payload is backward compatible because it already carries integrationId.

## 6. Acceptance criteria

1. Every sync route resolves the binding by integrationId; no lookup on (projectId, provider) remains in this module.
2. A foreign-workspace integrationId yields 403 on every sync route.
3. A projectId mismatch between route and binding yields 404.
4. Two bindings in one project maintain independent rule sets; saving rules on binding A leaves binding B's rules untouched.
5. Preview tokens are scoped per binding and cannot be replayed against a sibling binding.
6. Resume locking holds per integration scope; concurrent resumes of two different bindings do not contend on one lock.
7. `integration.sync_rules_changed` emits once per save with the binding's integrationId.

## 7. Test plan

| Case | Level |
|---|---|
| Sync rules keyed by integrationId; preview/save/review/resume per binding (extend `tests/api-integration/integration-sync-settings.test.ts`, `integration-sync-rules.test.ts`) | api-integration |
| Independent rule sets for two bindings in one project | api-integration |
| Foreign-workspace integrationId yields 403 on all five routes | api-integration |
| ProjectId mismatch yields 404 | api-integration |
| Preview token not replayable across bindings | api-integration |
| Resume lock isolation between bindings | api-integration |
| Compat shim resolves the first binding until client migration | api-integration |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Hidden (projectId, provider) lookups in sync helpers | Grep the module for `findFirst` with type equality; the WP9 matrix includes one negative test per route |
| Lock key still project-scoped, serializing sibling bindings | Lock-key review is an explicit PR checklist item |
| Compat shim keeps old clients writing rules to the first binding | Shim documented; removal tracked with WP7 |