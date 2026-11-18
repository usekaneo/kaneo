# WP1 — Access Control Middleware

RFC 0001, WP1. Governing decisions D1 and D2 have no direct impact on this package; it is a prerequisite for every integrationId-keyed route introduced by WP2, WP3, WP4, and WP5.

## 1. Objective

Provide `workspaceAccess.fromIntegration(paramName)`: middleware that loads an integration row by id, resolves integration to project to workspace, applies the same access checks as `fromProject`, and sets the workspace context. Without it, integrationId-keyed routes would allow an authenticated user of one workspace to address bindings of another workspace.

## 2. Current state (verified)

`apps/api/src/utils/workspace-access-middleware.ts` exposes a factory `workspaceAccessMiddleware(config)` driven by a `WorkspaceIdSource` union:

```ts
type WorkspaceIdSource =
  | { type: "query" | "body" | "param"; key: string }
  | { type: "lookup"; resource: "project" | "task" | "label" | "timeEntry" | "activity" | "comment" | "column" | "workflowRule" | "customField"; idKey: string }
  | { type: "lookupMany"; resource: "task"; idKey: string };
```

The lookup branch reads the resource id from the same place the handler reads it (path param or JSON body, deliberately not the query string, so a caller cannot authorize against one resource while the handler acts on another). It resolves the workspace, calls `validateWorkspaceAccess(userId, workspaceId, apiKey)`, and sets the workspace context. `apps/api/src/integrations/middleware.ts` additionally calls `assertProjectAccess` for project-scoped routes (`scopeToProjectFromBody`).

## 3. Implementation

### 3.1 Extend the lookup resource union

Add `"integration"` to the `resource` union in `WorkspaceIdSource`. The resolution chain is integration to project to workspace:

```ts
const [integration] = await db
  .select({ workspaceId: projectTable.workspaceId, projectId: integrationTable.projectId })
  .from(integrationTable)
  .innerJoin(projectTable, eq(projectTable.id, integrationTable.projectId))
  .where(eq(integrationTable.id, id))
  .limit(1);
```

### 3.2 Add the factory

In the `workspaceAccess` export object, alongside `fromProject`:

```ts
fromIntegration: (idKey: string) => workspaceAccessMiddleware({
  sources: [{ type: "lookup", resource: "integration", idKey }],
}),
```

The lookup reads the id from the path param when the route declares it there and from the JSON body otherwise, mirroring the existing resource lookups (task, column, workflowRule).

### 3.3 Project access assertion

Integration-keyed routes must also enforce project membership, not only workspace membership, consistent with `scopeToProjectFromBody`. The middleware resolves `projectId` from the integration and calls `assertProjectAccess(userId, projectId)` before setting `c.set("workspaceId", ...)`.

### 3.4 Semantics

| Situation | Result |
|---|---|
| Integration does not exist | 404, "Integration not found" |
| Integration exists in a foreign workspace | 403 (never confirm existence across workspaces; the acceptance criterion in RFC WP1 is a 403) |
| Integration exists in a foreign project of the same workspace | 403 via `assertProjectAccess` |
| Valid integration, missing `manage_settings` for mutations | Handled downstream by `requireWorkspacePermission({ workspace: ["manage_settings"] })`, which stays in the route definition |

Route usage pattern:

```ts
const integrationAccess = [
  workspaceAccess.fromIntegration("integrationId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];
```

Read-only routes (for example sync preview) may use `fromIntegration` without the `manage_settings` requirement, following the permission split already used per route group today.

## 4. Files

| File | Change |
|---|---|
| `apps/api/src/utils/workspace-access-middleware.ts` | `"integration"` lookup resource; `fromIntegration` factory; project access assertion |
| `apps/api/src/integrations/middleware.ts` | No change required; re-export if the provider route files import from there today |
| Provider route files | Wired in WP2, WP3, WP4; not part of this PR |

## 5. Acceptance criteria

1. A request carrying an integrationId belonging to another workspace yields 403 in route tests.
2. A request carrying a non-existent integrationId yields 404.
3. A workspace member without project access to the integration's project yields 403.
4. Mutations still require `manage_settings` when the route composes both middleware.
5. The id is honored from the path param on param routes and from the JSON body on body routes, and is never accepted from the query string (matching the existing security comment in the file).
6. All existing `workspaceAccess` behaviors (query, body, param, other lookups) remain covered by the existing middleware tests.

## 6. Test plan

| Case | Level |
|---|---|
| Foreign-workspace integrationId yields 403 | api-integration |
| Non-existent integrationId yields 404 | api-integration |
| Same workspace, foreign project yields 403 | api-integration |
| Param-based and body-based id extraction both resolve | api-integration |
| Query-string id is ignored (authorization uses param/body id only) | api-integration |
| Mutation without `manage_settings` yields 403 | api-integration |
| Regression: existing lookup resources still pass their tests | existing suites |

## 7. Risks

| Risk | Mitigation |
|---|---|
| fromIntegration forgotten on a new route during WP2–WP5 | Add a lint-style checklist item to each provider PR template: every integrationId-keyed route must compose `fromIntegration`; the WP9 matrix asserts one negative test per route |
| Duplicate workspace resolution adds latency | One indexed primary-key lookup plus one project join per request; negligible |