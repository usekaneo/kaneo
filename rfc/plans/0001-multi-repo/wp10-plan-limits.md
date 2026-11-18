# WP10 — Plan-Based Repository Limits (Billing)

New work package, resolving RFC 0001 open decision 10.2 per governing decision D2. The repository currently contains no billing, plan, or subscription infrastructure; this package therefore builds the limit mechanism as a self-contained, pluggable abstraction that a cloud billing stack can adopt without API changes.

## 1. Objective

Cap the number of active repository bindings per project, resolved per workspace from billing-plan configuration, enforced on creation and reactivation, exposed in list responses, and surfaced in the UI with an actionable upgrade path.

## 2. Design

### 2.1 Limit unit and counting rule

- Unit: active repository bindings per project across the three git providers (`type in ('github', 'gitea', 'gitlab')` and `is_active = true`).
- Cross-project sharing (D1) does not affect the count: a binding is counted once, in the project it belongs to. The same repository bound in two projects consumes one unit in each.
- Deactivated bindings (`is_active = false`) do not count; reactivation is re-checked against the limit.
- Non-git integrations are not counted.

### 2.2 Limit resolution

Resolution order, first match wins:

1. Per-workspace override: `workspace_limit.max_repositories_per_project` (nullable integer; the row is written by the billing system). The table is created in WP0.
2. Instance default: `KANEO_MAX_REPOSITORIES_PER_PROJECT` environment variable (integer; unset or non-positive means unlimited).
3. Unlimited.

```ts
// apps/api/src/plan-limits/resolve-limits.ts
export interface RepositoryBindingLimits {
  maxPerProject: number | null; // null = unlimited
}

export async function resolveRepositoryBindingLimits(
  workspaceId: string,
  database: IntegrationDatabase = db,
): Promise<RepositoryBindingLimits> {
  const [row] = await database
    .select({ maxRepositoriesPerProject: workspaceLimitTable.maxRepositoriesPerProject })
    .from(workspaceLimitTable)
    .where(eq(workspaceLimitTable.workspaceId, workspaceId))
    .limit(1);
  if (row?.maxRepositoriesPerProject != null) {
    return { maxPerProject: row.maxRepositoriesPerProject };
  }
  const envValue = Number(process.env.KANEO_MAX_REPOSITORIES_PER_PROJECT ?? "");
  return { maxPerProject: Number.isInteger(envValue) && envValue > 0 ? envValue : null };
}
```

The billing system integration point is the `workspace_limit` row: when a subscription changes plan, billing writes the new value, and the very next create request enforces it. No API process coupling is required. (If the cloud billing stack later needs a richer plan registry, `resolveRepositoryBindingLimits` is the only function to extend; the enforcement helper and all call sites remain unchanged.)

### 2.3 Enforcement helper

```ts
// apps/api/src/plan-limits/repository-binding-quota.ts
export async function countActiveRepositoryBindings(
  projectId: string,
  database: IntegrationDatabase = db,
): Promise<number> {
  const rows = await database
    .select({ id: integrationTable.id })
    .from(integrationTable)
    .where(and(
      eq(integrationTable.projectId, projectId),
      inArray(integrationTable.type, ["github", "gitea", "gitlab"]),
      eq(integrationTable.isActive, true),
    ));
  return rows.length; // or SQL count(*), see note below
}

export async function assertRepositoryBindingQuota(
  projectId: string,
  workspaceId: string,
  database: IntegrationDatabase = db,
): Promise<void> {
  const { maxPerProject } = await resolveRepositoryBindingLimits(workspaceId, database);
  if (maxPerProject === null) return;
  const used = await countActiveRepositoryBindings(projectId, database);
  if (used >= maxPerProject) {
    throw new HTTPException(402, {
      message: `Repository binding limit reached: this project already uses ${used} of ${maxPerProject} repository bindings included in the current plan.`,
    });
  }
}
```

Use a SQL `count(*)` rather than materializing ids; the sketch shows the shape. The helper accepts the shared `IntegrationDatabase` type so tests can inject a mock database.

### 2.4 Enforcement points

| Point | Caller | Behavior |
|---|---|---|
| Create binding | `create-github-integration.ts`, `create-gitea-integration.ts`, `create-gitlab-integration.ts` (WP2–WP4), after repository verification, before insert | 402 when at limit |
| Reactivate binding | The PATCH/update controllers, when `isActive` transitions false to true | 402 when at limit |
| Deactivate binding | PATCH setting `isActive` true to false | Always allowed; frees quota |
| Delete binding | Delete controllers | Always allowed; frees quota |

Race note: two concurrent creates can both pass the count check. This is acceptable for a billing guard (a small transient overshoot, never under-charging the plan by a meaningful margin). If strictness is required later, serialize the check-then-insert in one transaction with a `SELECT ... FOR UPDATE` on the project row; note this as a deliberate simplification in the PR description.

### 2.5 Error contract

| Field | Value |
|---|---|
| HTTP status | 402 Payment Required |
| Error code | `binding_limit_exceeded` |
| Message | Human-readable, includes current usage and limit |
| Response body extension | `{ used: number, limit: number }` so clients can render the exact state |

The status 402 is chosen over 403 to distinguish a billing condition from an authorization failure; clients treat 403 as a permissions problem and 402 as a plan-capacity problem.

### 2.6 Usage exposure

The list endpoints added in WP2, WP3, and WP4 return a usage summary alongside the array, so the UI needs no extra request:

```json
{
  "integrations": [ ... ],
  "usage": { "used": 3, "limit": 5 }
}
```

`limit` is `null` when unlimited. The single-integration detail responses do not carry usage.

### 2.7 Event

Publish `integration.binding_quota_exceeded` (workspaceId, projectId, used, limit) when a create is refused, giving the cloud billing stack a conversion signal. Reuse the existing `publishEvent` mechanism used by `integration.sync_rules_changed`.

## 3. Web UI (detailed in WP7, summarized here)

- Each provider settings section shows a quota indicator: "N of M repositories linked" (or "N repositories linked" when unlimited), derived from the list response usage summary.
- When the limit is reached, the add action does not disappear. It opens the repository browser, and the connect submit is refused server-side with 402; the client renders the server message inline with an upgrade call to action. Per the interface guidelines: never silently disable an option; state the blocker and the single action that resolves it.
- The quota indicator uses the existing Badge primitive; no new visual vocabulary.

## 4. Files

| File | Change |
|---|---|
| `apps/api/src/plan-limits/resolve-limits.ts` | New; limit resolution |
| `apps/api/src/plan-limits/repository-binding-quota.ts` | New; counting and assertion helper |
| `apps/api/src/database/schema.ts` | `workspace_limit` table (landed with WP0) |
| Provider create/update controllers (WP2–WP4) | Call `assertRepositoryBindingQuota` |
| Provider list endpoints (WP2–WP4) | Include usage summary |
| `apps/api/src/events` | `integration.binding_quota_exceeded` |
| `apps/docs` | Plan limits page: what counts, what happens at the limit, how to raise it |
| Web settings components (WP7) | Quota indicator and limit-reached flow |

## 5. Acceptance criteria

1. With a workspace override of 2, the third create for a project returns 402 with code `binding_limit_exceeded`, `used: 2`, `limit: 2`.
2. With no workspace row and the environment variable unset, creation is unlimited.
3. The environment variable default applies when no workspace row exists; a workspace row overrides it in both directions (stricter and looser).
4. Deactivating a binding frees quota: after deactivation, a previously refused creation succeeds.
5. Reactivating a binding when the project is at the limit returns 402.
6. Bindings across different providers count toward one shared per-project budget.
7. The usage summary in the list response matches the count used for enforcement.
8. The quota event is published exactly once per refused create.

## 6. Test plan

| Case | Level |
|---|---|
| At-limit create returns 402 with used/limit payload | api-integration |
| Unlimited when no override and no env | api-integration |
| Workspace override beats env in both directions | api-integration |
| Deactivation frees quota | api-integration |
| Reactivation at limit returns 402 | api-integration |
| Mixed-provider counting (github + gitea + gitlab toward one budget) | api-integration |
| Inactive rows do not count | api-integration |
| Non-git rows do not count | api-integration |
| usage summary equals enforcement count | api-integration |
| Quota event published on refusal | unit |
| resolveRepositoryBindingLimits with injected database | unit |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Concurrent creates transiently overshoot the limit | Accepted transient overshoot; documented; optional strict mode via row lock noted in the design |
| Billing stack expects synchronous limit queries | The abstraction resolves from the database on every request; no caching, so billing writes take effect immediately |
| Self-hosted instances surprised by limits | Default is unlimited; the env variable and its semantics are documented in WP8 |
| 402 handled poorly by existing clients | WP8 documents the contract; the MCP package review covers it; web client maps it to an actionable UI state |