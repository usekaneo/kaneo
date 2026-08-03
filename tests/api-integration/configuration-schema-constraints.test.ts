import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

async function createWorkspace(id: string) {
  await db.insert(schema.workspaceTable).values({
    id,
    name: id,
    slug: id,
    createdAt: new Date(),
  });
}

async function createProject(id: string, workspaceId: string) {
  await db.insert(schema.projectTable).values({
    id,
    workspaceId,
    slug: id,
    name: id,
  });
}

async function createItemType(id: string, workspaceId: string) {
  await db.insert(schema.itemTypeTable).values({
    id,
    workspaceId,
    key: id,
    name: id,
  });
}

describe("configuration schema tenant constraints", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects a saved view scoped to a project in another workspace", async () => {
    await createWorkspace("workspace-a");
    await createWorkspace("workspace-b");
    await createProject("project-b", "workspace-b");

    await expect(
      db.insert(schema.savedViewTable).values({
        id: "cross-workspace-view",
        workspaceId: "workspace-a",
        projectId: "project-b",
        key: "all",
        name: "All",
        type: "list",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "saved_view_workspace_project_fk",
      },
    });
  });

  it("accepts a saved view scoped to a project in the same workspace", async () => {
    await createWorkspace("workspace-a");
    await createProject("project-a", "workspace-a");

    const [savedView] = await db
      .insert(schema.savedViewTable)
      .values({
        id: "same-workspace-view",
        workspaceId: "workspace-a",
        projectId: "project-a",
        key: "all",
        name: "All",
        type: "list",
      })
      .returning({ id: schema.savedViewTable.id });

    expect(savedView?.id).toBe("same-workspace-view");
  });

  it("rejects an item type from another workspace on a task", async () => {
    await createWorkspace("workspace-a");
    await createWorkspace("workspace-b");
    await createProject("project-a", "workspace-a");
    await createItemType("item-type-b", "workspace-b");

    await expect(
      db.insert(schema.taskTable).values({
        id: "cross-workspace-task",
        projectId: "project-a",
        itemTypeWorkspaceId: "workspace-b",
        itemTypeId: "item-type-b",
        title: "Cross-workspace task",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "task_item_type_workspace_project_fk",
      },
    });
  });

  it("accepts an item type from the task project's workspace", async () => {
    await createWorkspace("workspace-a");
    await createProject("project-a", "workspace-a");
    await createItemType("item-type-a", "workspace-a");

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        id: "same-workspace-task",
        projectId: "project-a",
        itemTypeWorkspaceId: "workspace-a",
        itemTypeId: "item-type-a",
        title: "Same-workspace task",
      })
      .returning({ id: schema.taskTable.id });

    expect(task?.id).toBe("same-workspace-task");
  });

  it("accepts a legacy task without an item type", async () => {
    await createWorkspace("workspace-a");
    await createProject("project-a", "workspace-a");

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        id: "legacy-task",
        projectId: "project-a",
        title: "Legacy task",
      })
      .returning({ id: schema.taskTable.id });

    expect(task?.id).toBe("legacy-task");
  });

  it("rejects a partially null item type reference", async () => {
    await createWorkspace("workspace-a");
    await createProject("project-a", "workspace-a");

    await expect(
      db.insert(schema.taskTable).values({
        id: "partial-item-type-task",
        projectId: "project-a",
        itemTypeWorkspaceId: "workspace-a",
        title: "Partial item type task",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "task_item_type_pair_check",
      },
    });
  });

  it("treats null saved-view scopes as equal for uniqueness", async () => {
    await createWorkspace("workspace-a");

    const values = {
      workspaceId: "workspace-a",
      key: "all",
      name: "All",
      type: "list",
    };

    await db.insert(schema.savedViewTable).values({
      id: "global-view-1",
      ...values,
    });

    await expect(
      db.insert(schema.savedViewTable).values({
        id: "global-view-2",
        ...values,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "saved_view_scope_key_unique",
      },
    });
  });
});
