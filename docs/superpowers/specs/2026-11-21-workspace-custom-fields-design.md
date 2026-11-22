# Workspace project fields — design spec

- **Status:** Ready for implementation
- **Date:** 2026-11-21
- **Branch:** `develop`
- **Area:** API, web, mobile, MCP, database migration, docs
- **Builds on today's feature:** project-scoped custom fields for tasks

## 1. Intent and terminology

There are two different custom-field features. They must not be merged into one
concept in the data model, API, or UI.

| Name in this spec | Configured at | Applies to | Values stored per |
| --- | --- | --- | --- |
| **Task custom fields** (existing) | Project settings | A task in that project | Task |
| **Project custom fields** (new) | Workspace settings | Every project in the workspace | Project |

Today, a workspace admin who wants every project to expose "Customer",
"Environment", or "Contract value" has no way to declare it once. Project
settings only define fields for tasks, and those fields do not describe the
project itself.

This feature adds **workspace-owned definitions that apply to the project
object**. Once declared, every project in the workspace has those fields
available to fill in. A project created later gets them too.

Task custom fields keep working exactly as they do today. Project fields do not
appear on tasks, boards, task filters, or the create-task modal.

## 2. Baseline: existing task custom fields

The existing feature is defined by:

- `custom_field_definition`: belongs to one project, applies to tasks in that
  project. Stores `name`, `type`, `required`, `default_value`, `options`,
  `hidden_options`, `position`.
- `custom_field_value`: unique on `(task_id, field_id)`, value is text,
  multiselect is a JSON array string.
- `apps/api/src/custom-field/`: definitions, values, filters, reorder.
- Web: project settings page, task detail rows, card chips, filters,
  create-task defaults, per-user card visibility.
- Reusable domain rules:
  - `assertValidDefinition` validates required/default/options rules.
  - `resolveFieldUpdate` handles renames, option removal, hidden options, and
    dropdown ↔ multiselect conversion.
  - Defaults backfill existing rows in chunks.
  - A default belongs to the definition; a value can still be empty when the
    field is optional.

These rules are worth reusing. The value table and task read/write paths must
not be reused because the value target is different: a project, not a task.

## 3. Goals

1. An owner/admin defines a project field once in workspace settings.
2. Every project in the workspace shows that field and can store a value,
   including projects created after the definition.
3. Project settings let a user with `project:update` fill or clear project field
   values; clearing a required field is rejected.
4. Workspace settings let an owner/admin rename, change options/defaults,
   reorder, and delete project fields.
5. Task custom fields, task creation, boards, filters, and duplicate-task are
   unchanged.
6. Other clients can read project fields and write project values without
   breaking task custom-field calls.

## 4. Non-goals (v1)

- Per-project opt-in/opt-out for a workspace field.
- Per-project overrides of a workspace field's name, options, required flag, or
  default.
- Showing project fields on task cards or task detail.
- Formulas, conditional logic, validation expressions.
- Import/export, webhooks, or search indexing for project fields.
- Migrating existing task custom fields into project fields.

## 5. Anti-goals

- Do not mix project field values into `custom_field_value`.
- Do not make task endpoints accept project field ids.
- Do not let `project:update` change a definition that affects every project.
- Do not leak project fields or values across workspace boundaries.
- Do not add one query per project on workspace settings.

## 6. Actors and permissions

| Action | Permission |
| --- | --- |
| Read project field definitions | `workspace:read` |
| Create, update, delete, reorder project fields | `workspace:manage_settings` |
| Read project field values for a project | `project:read` |
| Set or clear a project field value | `project:update` |

`workspace:manage_settings` already exists in
`packages/permissions/src/index.ts`. Defining a field affects every project, so
`project:update` is too narrow. Filling a value only affects one project, so
`project:update` is the right check.

## 7. Approaches considered

### A. Workspace definition table + project value table (chosen)

- `workspace_custom_field_definition` owns the definition and belongs to a
  workspace.
- `project_custom_field_value` stores one value per project and field.

Pros: the target is explicit; task and project values never mix; existing task
custom fields are untouched; project values can be joined and backfilled
independently; one additive migration.

Cons: new controllers and UI surfaces; some definition validation code should be
extracted or shared.

### B. Add a `target` column to the existing definition/value tables (rejected)

A polymorphic definition (`target = "task" | "project"`) and value table would
force every existing task query to filter by target and would allow invalid
cross-target rows. The value row would need either `task_id` or `project_id`,
reintroducing the same polymorphism in the hottest table.

### C. Copy project fields into each project's task definitions (rejected)

This would show project fields on tasks, which is the wrong object. It also has
no single source of truth for definitions.

**Decision: A.** Definitions are workspace-owned; values are project-owned.

## 8. Data model and migration

Add two tables in `apps/api/src/database/schema.ts`. Generate the migration with
`pnpm --filter @kaneo/api db:generate` and inspect the SQL.

### 8.1 `workspace_custom_field_definition`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | `createId()` |
| `workspace_id` | text NOT NULL | FK `workspace(id)` cascade |
| `name` | text NOT NULL | |
| `type` | text NOT NULL | `text`, `number`, `date`, `dropdown`, `boolean`, `multiselect` |
| `required` | boolean NOT NULL default false | project must have a value |
| `default_value` | text NULL | applied to new and backfilled projects |
| `options` | jsonb NULL | dropdown / multiselect |
| `hidden_options` | jsonb NOT NULL default `[]` | retired options |
| `position` | integer NOT NULL default 0 | workspace-scoped order |
| `created_at`, `updated_at` | timestamp NOT NULL | same conventions as existing tables |

Index: `workspace_custom_field_def_workspaceId_idx` on `workspace_id`.

### 8.2 `project_custom_field_value`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `project_id` | text NOT NULL | FK `project(id)` cascade |
| `field_id` | text NOT NULL | FK `workspace_custom_field_definition(id)` cascade |
| `value` | text NULL | text, JSON array for multiselect |
| `created_at`, `updated_at` | timestamp NOT NULL | |

Indexes: `(project_id)`, `(field_id)`, unique `(project_id, field_id)`.

### 8.3 Relations

- workspace → many definitions
- definition → workspace, many project values
- project → many project field values
- value → project, definition

No existing table is altered. Existing task custom-field data is untouched.

## 9. API contract

Create a new module `apps/api/src/workspace-custom-field/` (or an equivalent
name that makes the "project object" target obvious). Do not add these routes to
`apps/api/src/custom-field/`.

### 9.1 Definition response

```ts
type WorkspaceCustomFieldDefinition = {
  id: string;
  workspaceId: string;
  name: string;
  type: "text" | "number" | "date" | "dropdown" | "boolean" | "multiselect";
  required: boolean;
  defaultValue: string | null;
  options: unknown | null;
  hiddenOptions: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
};
```

### 9.2 Endpoints

| Endpoint | Permission | Behaviour |
| --- | --- | --- |
| `GET /workspace-custom-field/workspace/{workspaceId}` | `workspace:read` | Definitions ordered by `position` |
| `POST /workspace-custom-field/` | `workspace:manage_settings` | Body `{ workspaceId, name, type, required?, defaultValue?, options? }` |
| `PUT /workspace-custom-field/{id}` | `workspace:manage_settings` | Same body as today's definition update |
| `DELETE /workspace-custom-field/{id}` | `workspace:manage_settings` | Cascades project values |
| `PUT /workspace-custom-field/reorder/{workspaceId}` | `workspace:manage_settings` | Same body shape as task-field reorder |
| `GET /workspace-custom-field/{id}/usage` | `workspace:manage_settings` | Project count and non-empty value count |
| `GET /workspace-custom-field/project/{projectId}` | `project:read` | Definitions for the project's workspace + that project's values |
| `PUT /workspace-custom-field/project/{projectId}/value` | `project:update` | Body `{ fieldId, value }`; upsert one value |

Route middleware:

- Creation takes `workspaceId` in the body, so it uses
  `workspaceAccess.fromBody()`.
- Workspace reads/reorder use `workspaceAccess.fromParam("workspaceId")`.
- Update/delete/usage resolve the owning workspace from the definition id and
  check `workspace:manage_settings`.
- Project reads/values resolve the workspace from `projectId` and check
  `project:read` / `project:update`.
- A definition from another workspace and a project from another workspace must
  return 404, not 403, to avoid leaking existence.

### 9.3 Project field values response

`GET /workspace-custom-field/project/{projectId}` returns definitions joined
with this project's values:

```ts
type ProjectCustomField = {
  id: string;              // definition id
  projectId: string;
  workspaceId: string;
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  options: unknown | null;
  hiddenOptions: string[];
  position: number;
  value: string | null;    // null when never set
  valueId: string | null;
};
```

Workspace settings calls the workspace definitions endpoint and does not need
per-project values.

## 10. Validation and lifecycle

Reuse `assertValidDefinition` and `resolveFieldUpdate` for names, types,
defaults, required rules, options, and hidden options. Add only the project-value
rules below.

### 10.1 Create a project field

1. Verify the workspace exists and the caller has `workspace:manage_settings`.
2. Validate the definition with the same rules as task fields.
3. Insert the definition with `position = max + 1`.
4. Insert the default value for every project in the workspace in chunks.
5. Return the definition.

Because these are project values, not task values, the backfill is one row per
project and stays cheap. It runs synchronously. Archived projects are included.

### 10.2 Project creation

`insertProject` and `insertUnplacedProject` in
`apps/api/src/project/controllers/insert-project.ts` seed project field values
from the workspace definitions in the same transaction:

- insert a value for every definition with a non-empty default;
- insert a value for every `required` definition (validation guarantees a
  default exists for required fields).

Construction through import (`insertUnplacedProject`) follows the same path.

### 10.3 Update a definition

- Reuse `resolveFieldUpdate`.
- Usage checks for removed or renamed options consider project values across the
  whole workspace.
- Dropdown ↔ multiselect conversion rewrites project values as it does for task
  values.
- When `required` turns on and a default exists, fill projects with empty or
  missing values.
- Default changes do not rewrite values already entered by a project. Only the
  required-fill path writes values, matching the task-field behaviour.

### 10.4 Set a project value

- Verify the project belongs to the definition's workspace.
- Optional empty value clears the stored value (`null` or empty string).
- Required field cannot be cleared.
- Type, dropdown option, multiselect JSON array, and hidden-option rules match
  the existing task value validation.
- Upsert on `(project_id, field_id)`.

### 10.5 Delete a definition

Cascade project values. The UI confirms with project count and value count from
the usage endpoint before deleting.

### 10.6 Reorder

All ids must belong to the workspace; otherwise return 400. Project values are
unaffected.

### 10.7 Move a project to another workspace

Moving a project changes which workspace definitions apply:

- In the same transaction as the move, delete `project_custom_field_value` rows
  whose definition belongs to the source workspace.
- Insert defaults for the destination workspace's project fields.
- Keep task custom-field data as it is; task fields are project-owned and move
  with the project.

Do not leave source workspace values readable through the destination project.

### 10.8 Archive and delete

- Archiving a project does not change its project field values.
- Deleting a project cascades its project field values.
- Deleting a workspace cascades definitions; deleting definitions cascades
  project values.

## 11. Web UI

### 11.1 Workspace settings

Add `dashboard/settings/workspace/project-fields` and a workspace nav link.

- Title: "Project fields" (i18n key `settings:workspaceProjectFields.*`).
- Copy explains: "Fields every project in this workspace has, like Customer or
  Environment."
- Reuse the definition dialog and row components from
  `components/project/custom-fields/field-dialog` and `custom-field-row` by
  extracting the definition form into a shared module with a scope prop:
  - project scope → task custom fields (today);
  - workspace scope → project custom fields (new).
- Creating, editing, reordering, deleting, defaults, required fields, hidden
  options, and choice conversion behave exactly like the task-field UI.
- Delete confirmation shows affected project count and value count.

### 11.2 Project settings

Add a "Project fields" section to project general settings (or a dedicated
`projects/$projectId/fields` page if the form grows).

- Reads `GET /workspace-custom-field/project/{projectId}`.
- Renders one input per field in definition order, with the same controls as
  task fields: text, number, date, dropdown, boolean, multiselect.
- Saves through the per-field value endpoint; optimistic update with rollback on
  error.
- Shows required markers and prevents clearing a required value.
- Users without `project:update` see values read-only.
- No link to edit definitions here; the section says the field is defined at
  workspace level.

### 11.3 Do not change task surfaces

Task detail, task cards, task filters, task create/duplicate, and the task
custom-field settings page stay on the existing data and endpoints. Project
fields must not appear there.

### 11.4 Cache keys

- `["workspace-custom-fields", workspaceId]`
- `["project-custom-field-values", projectId]`

Update mutation invalidation and `apps/web/src/lib/evict-workspace-cache.ts`.

## 12. Realtime

Publish events through the existing `publishEvent()` path:

- `project-custom-field.definition_changed` with
  `{ workspaceId, fieldId, action: "created" | "updated" | "deleted" | "reordered" }`.
- `project-custom-field.value_changed` with
  `{ workspaceId, projectId, fieldId, value }`.

The WebSocket handler invalidates the two project-field query keys. Redis fan-out
stays optional; a single instance without Redis must keep working.

Task custom-field events are out of scope for this feature and keep today's
behaviour.

## 13. Mobile, MCP, and docs

- **Mobile:** project settings may render project field values read-only or
  editable with `project:update`; editing definitions is out of scope. Task
  screens are unchanged.
- **MCP:** keep all task custom-field tools unchanged. If project metadata is
  exposed, add `list_project_custom_fields` and `set_project_custom_field_value`
  with the same permission model; do not overload the task tools.
- **Docs/OpenAPI:** document that project fields describe projects and task
  fields describe tasks. Add the new endpoints to the OpenAPI spec and run
  `pnpm openapi:check:fix`. `apps/docs/openapi.json` is committed.

## 14. Security and isolation

- Definition writes must resolve the definition's workspace, never trust a body
  `workspaceId` alone.
- Project value writes must join the project to the definition's workspace; a
  field from another workspace returns 404.
- Read endpoints must scope both definitions and values by workspace. A stale
  value row must never expose a definition from another workspace.
- The UI must not be the authorization boundary. Every route checks permission
  server-side.
- Do not log project field values.

## 15. Rollout and compatibility

1. The migration adds two tables and changes no existing table.
2. Task custom-field endpoints, responses, and UI remain compatible.
3. No existing data is converted; no backfill of existing projects beyond the
   default value of a newly created definition.
4. No new environment variables, Redis requirement, Helm change, or Docker
   change.
5. `@kaneo/libs`, mobile types, and committed OpenAPI are regenerated in the
   same release.

## 16. Test plan

### API integration

- Owner/admin creates, updates, reorders, deletes a project field; member gets
  403; project manager without `workspace:manage_settings` gets 403.
- A project field appears on every existing project and on a project created
  afterwards.
- A default value backfills existing projects; no task rows are created.
- Project creation applies defaults in the same transaction.
- `required` field rejects an empty value; optional field accepts a clear.
- Hidden options: existing project value kept, new pick rejected.
- Dropdown ↔ multiselect conversion updates project values across projects.
- Deleting a definition cascades project values.
- Deleting a workspace cascades definitions and values.
- A project field id is rejected by task value create/update (`PUT
  /custom-field/value`).
- A project from another workspace cannot read or write a definition's value.
- Moving a project to another workspace removes source workspace values and
  seeds destination defaults; task custom-field values are untouched.
- Usage endpoint returns the right project and value counts.
- Existing task custom-field tests still pass unchanged.

### Web

- Workspace settings creates a field and shows it in the list.
- Project settings shows the field input and saves/clears a value.
- Required marker and required-clear rejection.
- Read-only rendering without `project:update`.
- Task detail, boards, filters, and create-task modal do not show the project
  field.
- Realtime definition/value events invalidate only project-field queries.

### Mobile and MCP

- Project settings renders values without offering definition editing.
- Task custom-field tools keep their current payloads and behaviour.

### Repo checks

- `pnpm --filter @kaneo/api test`
- Affected web tests
- `pnpm typecheck`
- `pnpm openapi:check:fix`

## 17. Acceptance criteria

- [ ] An owner/admin defines "Customer" in workspace settings once.
- [ ] Every project in the workspace, including new ones, shows a "Customer"
      input under project settings.
- [ ] Filling the input stores a value for that project only; another project
      keeps its own value.
- [ ] Project fields never appear on tasks, boards, task filters, or the
      create-task modal.
- [ ] Existing task custom fields keep working unchanged.
- [ ] A project manager can fill project values but cannot edit the workspace
      definition.
- [ ] Deleting a definition warns with impact and cascades project values.
- [ ] Moving a project to another workspace does not leave source workspace
      field data.
- [ ] Typecheck, API tests, affected web tests, and OpenAPI check pass.

## 18. Risks

| Risk | Mitigation |
| --- | --- |
| Users confuse project fields with task custom fields | Separate settings pages, separate API module, explicit copy: "applies to projects" vs "applies to tasks" |
| Task surfaces accidentally include project fields | Project fields live in new tables and new endpoints; task queries do not join them |
| A project value outlives its definition | FK cascade plus integration tests |
| Moving a project leaks source workspace values | Delete source values and seed destination defaults in the move transaction |
| Definition updates rewrite values silently | Only required-fill and choice conversion may rewrite values, matching current task-field rules |
| Large workspace backfill blocks the create request | One row per project, chunked insert; realistically small; add an explicit cap only if measurements require it |
| Duplicate validation logic | Extract shared definition validation instead of copying it |

## 19. Implementation order

1. Add schema, relations, and migration for the two tables.
2. Add shared definition validation extraction if needed; build the workspace
   definition controllers and routes.
3. Add project value read/write controllers and authorization.
4. Seed project values in project creation and project move.
5. Add web fetchers, hooks, query keys, and workspace settings page.
6. Add the project settings values section.
7. Add realtime events and invalidation.
8. Add mobile read support, MCP tools, docs, and OpenAPI.
9. Run integration tests and acceptance checks.

## 20. Open questions

1. Should the project field values live on the project general page or a
   dedicated "Project fields" page? Recommendation: start on the general page;
   split only if the form needs its own layout.
2. Should mobile allow editing project values in v1, or read-only first?
   Recommendation: read-only first.
3. Should an existing task custom field be promotable to a project field later?
   Yes, but as a separate follow-up with an explicit type/target conversion.
