# Workspace Labels Settings

Add a "Labels" configuration section to the workspace settings tab, allowing users to create, edit, and delete workspace-level labels.

## Background

Labels can exist at two levels in the database:
- **Workspace-level** (`taskId = null`): Reusable label templates unique by name within a workspace.
- **Task-level** (`taskId` set): An instance of a workspace label assigned to a specific task.

Currently, workspace-level labels can only be managed indirectly through the task label picker popover. There is no dedicated management UI for listing, editing, or deleting workspace-level labels from the settings.

A `@/constants/label-colors.ts` file already exists with the 9 label color definitions. The API endpoints for CRUD mostly exist but need minor fixes.

---

## Steps

### Step 1: Fix API — Allow deletion of workspace-level labels

**File: `apps/api/src/label/controllers/delete-label.ts`**

The current `deleteLabel` controller rejects deletion of labels with `taskId = null` (workspace-level labels) with a 400 error. This needs to be updated to:

- If the label has a `taskId` (task-level): keep existing logic — fetch the task, delete, sync to GitHub, publish event.
- If the label has **no `taskId`** (workspace-level): just delete the row directly. No GitHub sync or event needed.

**Specific changes:**
- Remove the guard that throws 400 when `taskId` is null (lines 19-23).
- Branch logic: if `taskId` exists, do the existing full flow (fetch task, delete, GitHub sync, publish event). If `taskId` is null, just `db.delete(labelTable).where(eq(labelTable.id, id))`.

### Step 2: Fix frontend — Add cache invalidation to `useUpdateLabel`

**File: `apps/web/src/hooks/mutations/label/use-update-label.ts`**

The `useUpdateLabel` mutation hook has **no `onSuccess` callback**, so after updating a label's name or color, the cached label lists in the frontend are stale until a refetch happens. 

Add cache invalidation on success: after the mutation completes, invalidate the `["labels", workspaceId]` query key so the workspace labels list refreshes automatically.

**Note:** The response from `PUT /label/:id` returns the updated label which includes `workspaceId`, so the hook can access `updatedLabel.workspaceId` for the query key.

### Step 3: Create the Labels settings page route + component

**New file: `apps/web/src/routes/_layout/_authenticated/dashboard/settings/workspace/labels.tsx`**

This is the main page. Structure:

1. **Page layout**: Follow the pattern from `general.tsx` — use `PageTitle`, translated texts, section-based layout.
2. **Data fetching**: Use `useGetLabelsByWorkspace(workspaceId)` to fetch all workspace-level labels (filtered by `taskId = null`).
3. **Labels list**: Render existing labels as a list/table with:
   - Color dot + name display
   - Edit button (opens a dialog)
   - Delete button (with confirmation dialog)
4. **Create label**: A "Create Label" button at the top that opens a dialog with name input + color picker. Uses `useCreateLabel` mutation.
5. **Edit label**: Dialog pre-filled with current name and color. Uses `useUpdateLabel` mutation.
6. **Delete label**: AlertDialog confirmation, then calls `useDeleteLabel` mutation.
7. **Permission gating**: Use `canManageLabels()` from `useWorkspacePermission` to conditionally show/hide create/edit/delete controls.
8. **Color picker**: Reuse `labelColors` from `@/constants/label-colors` for the 9-color palette (same colors as in the task label picker).

### Step 4: Add sidebar link for Labels in workspace settings

**File: `apps/web/src/routes/_layout/_authenticated/dashboard/settings/workspace.tsx`**

Add a new "Labels" menu item to the `menuItems` array:
- `title`: `t("settings:workspaceLabels.title", { defaultValue: "Labels" })`
- `url`: `/dashboard/settings/workspace/labels`
- `icon`: `Tag` from `lucide-react`

### Step 5: Add translation keys

**File: `i18n/en-US.json`** (and add to `i18n/schema.json`)

Add `workspaceLabels` key under the `settings` section:
```json
"workspaceLabels": {
  "pageTitle": "Label Management",
  "title": "Labels",
  "subtitle": "Create, edit, and delete workspace-level labels.",
  "createLabel": "Create Label",
  "editLabel": "Edit Label",
  "deleteLabel": "Delete Label",
  "nameLabel": "Label name",
  "namePlaceholder": "Enter label name",
  "colorLabel": "Color",
  "deleteConfirmTitle": "Delete this label?",
  "deleteConfirmDescription": "This will permanently remove this label from all tasks. This action cannot be undone.",
  "empty": "No labels yet. Create your first label to get started.",
  "createSuccess": "Label created",
  "updateSuccess": "Label updated",
  "deleteSuccess": "Label deleted",
  "createError": "Failed to create label",
  "updateError": "Failed to update label",
  "deleteError": "Failed to delete label",
  "nameRequired": "Label name is required"
}
```

### Step 6: Regenerate the route tree

Run `pnpm dev` or the TanStack Router codegen so the new route file gets picked up in `routeTree.gen.ts`. The file-based routing will auto-detect `labels.tsx` as a child of `workspace.tsx` and wire it up.

Alternatively, if auto-generation is not running, manually trigger: check if there's a route generation command in package.json scripts.

---

## API Change Summary

| File | Change |
|------|--------|
| `apps/api/src/label/controllers/delete-label.ts` | Allow deletion of workspace-level labels (no taskId) |
| `apps/web/src/hooks/mutations/label/use-update-label.ts` | Add cache invalidation on success |

## New Frontend Files

| File | Purpose |
|------|---------|
| `apps/web/src/routes/_layout/_authenticated/dashboard/settings/workspace/labels.tsx` | Labels settings page with CRUD UI |

## Modified Frontend Files

| File | Change |
|------|--------|
| `apps/web/src/routes/_layout/_authenticated/dashboard/settings/workspace.tsx` | Add "Labels" nav item to sidebar |
| `i18n/en-US.json` | Add `workspaceLabels` translation keys |
| `i18n/schema.json` | Add `workspaceLabels` schema definition |
