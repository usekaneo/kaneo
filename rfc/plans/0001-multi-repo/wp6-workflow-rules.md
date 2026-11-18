# WP6 — Workflow Rules

RFC 0001, WP6. Adds optional per-binding workflow rules with a type-wide fallback. Governing decisions: D1 means one shared repository can carry different workflow behavior per project binding (rules are integration-scoped, never repository-scoped globally); D2 does not apply.

## 1. Objective

Allow workflow rules to target a single repository binding (`integration_id` set) while keeping the existing project-wide per-provider semantics (`integration_id` NULL) unchanged. Resolution prefers the repository-specific rule and falls back to the type-wide rule.

## 2. Current state (verified)

`workflow_rule` columns: `id, project_id, integration_type, event_type, column_id, created_at, updated_at`; indexes on projectId and columnId; no integration reference. `apps/api/src/workflow-rule/controllers/upsert-workflow-rule.ts` finds the rule by (projectId, integrationType, eventType) and updates or inserts the columnId. Resolution happens in `resolveTargetStatus`, which is keyed by (projectId, integrationType, eventType) today.

## 3. Schema

Landed with WP0 (same migration PR): `workflow_rule.integration_id`, nullable text, FK to `integration` with cascade delete. Existing rows keep NULL and keep their current type-wide meaning; no data change is required. A rule with `integration_id` set must reference an integration of the same `type` and the same `project_id`; this invariant is enforced in the controller (application-level), not by a composite FK.

## 4. Upsert (`upsert-workflow-rule.ts`)

Accept an optional `integrationId`. Validation order:

1. Column belongs to the project (existing check, 400).
2. When `integrationId` is provided: the integration exists (404), belongs to the same project (400), and its `type` equals `integrationType` (400). The access check for the integration itself is provided by the route middleware (`fromIntegration`), which is why the upsert route accepts the id both as the rule target and as the addressed resource.
3. Lookup key: (projectId, integrationType, eventType, integrationId). Because SQL `integration_id = NULL` never matches, the lookup must be:

```ts
const existing = await db.query.workflowRuleTable.findFirst({
  where: integrationId
    ? and(
        eq(workflowRuleTable.projectId, projectId),
        eq(workflowRuleTable.integrationType, integrationType),
        eq(workflowRuleTable.eventType, eventType),
        eq(workflowRuleTable.integrationId, integrationId),
      )
    : and(
        eq(workflowRuleTable.projectId, projectId),
        eq(workflowRuleTable.integrationType, integrationType),
        eq(workflowRuleTable.eventType, eventType),
        isNull(workflowRuleTable.integrationId),
      ),
});
```

4. Update or insert accordingly. The public API shape for type-wide rules (integrationId absent) is unchanged, so the current workflow editor keeps working; the per-repository selector is added in WP7.

## 5. Resolution (`resolveTargetStatus`)

Resolution precedence for an event from a given binding:

1. Rule matching (projectId, integrationType, eventType, integrationId of the binding) — repository-specific.
2. Rule matching (projectId, integrationType, eventType, integrationId IS NULL) — type-wide fallback.

```ts
const specific = await db.query.workflowRuleTable.findFirst({
  where: and(
    eq(workflowRuleTable.projectId, integration.projectId),
    eq(workflowRuleTable.integrationType, integration.type),
    eq(workflowRuleTable.eventType, eventType),
    eq(workflowRuleTable.integrationId, integration.id),
  ),
});
const rule = specific ?? await db.query.workflowRuleTable.findFirst({
  where: and(
    eq(workflowRuleTable.projectId, integration.projectId),
    eq(workflowRuleTable.integrationType, integration.type),
    eq(workflowRuleTable.eventType, eventType),
    isNull(workflowRuleTable.integrationId),
  ),
});
```

The caller must pass the integration of the event's binding (available in every webhook handler, which already resolve the integration before applying rules). If a caller cannot identify a binding (for example a legacy path without integration context), it resolves with the NULL-only lookup, which is today's behavior.

An index on `workflow_rule (project_id, integration_type, event_type, integration_id)` is added in the WP0 migration to keep resolution a single indexed lookup.

## 6. Routes and read model

- `get-workflow-rules.ts` returns `integrationId` (nullable) on each rule so the editor can distinguish type-wide from repository-specific rules; no other shape change.
- The upsert route gains the optional `integrationId` in its body schema; when present, the route composes `workspaceAccess.fromIntegration("integrationId")` in addition to the project access it already performs.
- Deleting a binding cascades its repository-specific rules away (FK cascade); the type-wide rules are untouched.

## 7. Files

| File | Change |
|---|---|
| `apps/api/src/database/schema.ts` | `workflow_rule.integration_id` and the resolution index (WP0 PR) |
| `apps/api/src/workflow-rule/controllers/upsert-workflow-rule.ts` | Optional integrationId; validation; NULL-aware lookup |
| `apps/api/src/workflow-rule/controllers/get-workflow-rules.ts` | Return integrationId per rule |
| `apps/api/src/workflow-rule/index.ts` | Body schema; fromIntegration wiring when integrationId present |
| `resolveTargetStatus` (workflow-rule service / plugin shared code) | Precedence resolution per section 5 |

## 8. Acceptance criteria

1. A repository-specific rule wins over the type-wide rule for events from that binding.
2. Events from sibling bindings without a specific rule fall back to the type-wide rule.
3. Type-wide rules (integrationId absent) keep the current API shape and behavior; the existing editor is unaffected.
4. A rule referencing a foreign-project or wrong-type integration is rejected with 400.
5. Deleting a binding removes only its repository-specific rules.
6. A repository shared across two projects (D1) can carry different rules in each project, because resolution is keyed by integration row, not by repository key.

## 9. Test plan

| Case | Level |
|---|---|
| Repository-specific rule wins over type-wide fallback | unit (resolveTargetStatus) |
| Sibling binding falls back to type-wide | unit |
| NULL-aware upsert: two rules coexist for (project, type, event) with and without integrationId | api-integration |
| Validation rejections (wrong project, wrong type) | api-integration |
| Cascade delete removes only specific rules | api-integration |
| Shared repository, different rules per project binding | unit (D1) |
| Regression: existing type-wide rule behavior unchanged | existing suites |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Callers resolve rules without binding context and silently lose specificity | Resolution function signature takes the integration; a type check or unit test pins every caller to pass it |
| Duplicate-looking rules (NULL and specific) confuse the editor | get-workflow-rules returns integrationId; WP7 renders the scope explicitly per row |
| NULL equality pitfalls in custom SQL | NULL-aware `isNull` lookups are unit-tested in both upsert and resolution |