# WP0 — Database Migration

RFC 0001, sections 4.1–4.3. Governing decisions D1 (cross-project sharing) and D2 (billing limits) apply; this document states their schema-level consequences.

## 1. Objective

Convert the one-row-per-project-per-type rule on the `integration` table into a repository-scoped model: multiple rows per project and type, each identified by derived repository identity columns, with uniqueness enforced only inside a project. Introduce the nullable `workflow_rule.integration_id` column. Add the workspace limits table required by WP10.

## 2. Current state (verified in `apps/api/src/database/schema.ts`)

```ts
export const integrationTable = pgTable(
  "integration",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    projectId: text("project_id").notNull().references(() => projectTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: text("type").notNull(),
    config: text("config").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("integration_projectId_idx").on(table.projectId),
    index("integration_type_idx").on(table.type),
    unique("integration_project_type_unique").on(table.projectId, table.type),
  ],
);
```

`workflow_rule` currently has columns `id, project_id, integration_type, event_type, column_id, created_at, updated_at` with indexes on projectId and columnId, and no integration reference.

## 3. Target schema

Deviation from RFC section 4.2 per decision D1: the instance-wide `unique(type, repository_key)` is not created. The `(type, repository_key)` structure becomes a non-unique index. A partial unique index preserves the single-row guarantee for integrations without repository identity (Slack, Discord, Mattermost, Telegram, generic webhook), which would otherwise be lost when `integration_project_type_unique` is dropped.

```ts
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
    index("integration_type_repository_key_idx").on(table.type, table.repositoryKey),
    unique("integration_project_type_repo_unique").on(table.projectId, table.type, table.repositoryKey),
  ],
);
```

In addition, a raw SQL step in the migration adds:

```sql
CREATE UNIQUE INDEX integration_project_type_null_repo_unique
  ON integration (project_id, type)
  WHERE repository_key IS NULL;
```

`workflow_rule` gains:

```ts
integrationId: text("integration_id").references(() => integrationTable.id, {
  onDelete: "cascade",
  onUpdate: "cascade",
}),
```

Existing rules keep NULL and therefore keep their type-wide semantics; no data change is required.

For WP10, add the workspace limits override table:

```ts
export const workspaceLimitTable = pgTable("workspace_limit", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaceTable.id, { onDelete: "cascade", onUpdate: "cascade" }),
  maxRepositoriesPerProject: integer("max_repositories_per_project"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

A NULL `max_repositories_per_project` means "no workspace override; fall back to the instance default". The billing system writes this row; the API only reads it.

## 4. Migration file

One drizzle-kit migration into `apps/api/drizzle` plus a custom SQL step, following the precedent of `plugins/github/migration.ts` and `src/migrations/column-migration.ts`. Order matters and is fixed:

### Step 1 — Add nullable columns

`repository_key, repository_owner, repository_name, repository_id, base_url` on `integration`; `integration_id` on `workflow_rule`; the `workspace_limit` table.

### Step 2 — Backfill from config JSON

```sql
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
```

Provider-specific notes: Gitea config stores `baseUrl` before normalization; if the stored value is not normalized, the backfill must apply `normalizeGiteaBaseUrl` semantics in SQL (strip trailing slash, lowercase scheme and host). The exact normalization must match the TypeScript helper, and a unit test asserts the equivalence. GitLab keys on the full project path (`projectPath`), not owner/name.

### Step 3 — Create indexes

```sql
CREATE INDEX integration_type_repository_key_idx ON integration (type, repository_key);
CREATE UNIQUE INDEX integration_project_type_repo_unique ON integration (project_id, type, repository_key);
CREATE UNIQUE INDEX integration_project_type_null_repo_unique ON integration (project_id, type) WHERE repository_key IS NULL;
```

Safety argument: `unique(project_id, type)` currently guarantees at most one row per project and type, so the new per-project unique cannot be violated by existing data. The partial unique index trivially holds for existing data for the same reason.

Deliberately absent per decision D1: `CREATE UNIQUE INDEX integration_type_repo_unique ON integration (type, repository_key)`. Cross-project duplicates are valid rows.

### Step 4 — Drop the old constraint

```sql
ALTER TABLE integration DROP CONSTRAINT integration_project_type_unique;
```

### Step 5 — Rollback guard

Before re-adding the old unique, the migration asserts:

```sql
SELECT count(*) = count(DISTINCT (project_id, type)) FROM integration;
```

If the assertion fails (users have already linked a second repository), the downgrade is refused with a clear error. The migration stays reversible until real multi-binding data exists.

## 5. Files

| File | Change |
|---|---|
| `apps/api/src/database/schema.ts` | Target schema above; `workspaceLimitTable`; `workflow_rule.integration_id` |
| `apps/api/src/database/relations.ts` | No structural change; verify integration relations (project, externalLinks) still resolve |
| `apps/api/drizzle/<next>_multi_repo_integrations.sql` | The migration with steps 1–5 |
| Drizzle config / migration runner | Confirm the custom SQL step is registered the same way as existing column migrations |

## 6. Acceptance criteria

1. `db:generate` produces the migration; `db:migrate` runs against a database with existing single-repository rows for all three providers and leaves `repository_key` populated for every github, gitea, and gitlab row.
2. The rollback guard passes on a pre-migration database and refuses a downgrade after a second binding exists.
3. Inserting two rows with the same `(type, repository_key)` but different `project_id` succeeds in a post-migration database (D1 acceptance).
4. Inserting two rows with the same `(project_id, type, repository_key)` fails with a unique violation (per-project acceptance).
5. Inserting two slack-type rows for one project fails via the partial unique index (non-git guarantee preserved).
6. `workflow_rule.integration_id` exists, is nullable, and cascades on integration delete.
7. Old API code runs unchanged against the new schema (additivity check): the config JSON remains the source of truth for provider settings.

## 7. Test plan

| Case | Level |
|---|---|
| Backfill populates repository identity for github (numeric and legacy owner/name rows), gitea, gitlab | migration test |
| Backfill normalization matches `normalizeGiteaBaseUrl` | unit |
| Per-project unique rejects duplicate; cross-project duplicate succeeds | migration/database test |
| Partial unique rejects a second NULL-key row per project and type | migration/database test |
| Rollback guard passes before and refuses after multi-binding | migration test |
| workflow_rule integration cascade delete | migration/database test |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Stored Gitea base URLs are unnormalized and produce keys that differ from controller-derived keys | Normalize in SQL to match the TypeScript helper; test equivalence; if a mismatch is detected at runtime, treat the binding as legacy and re-derive on update |
| Long-running backfill on large instances | The UPDATE is a single statement; document expected duration and recommend running with the API in maintenance mode for very large instances |
| Partial unique index overlooked by reviewers used to the RFC text | Called out in the PR description; D1 recorded in the plan overview |