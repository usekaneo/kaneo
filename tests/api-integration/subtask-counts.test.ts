import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import updateColumn from "../../apps/api/src/column/controllers/update-column";
import db, { schema } from "../../apps/api/src/database";
import { eventContext } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { getPublicProject } from "../../apps/api/src/project/controllers/get-public-project";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import getTasks from "../../apps/api/src/task/controllers/get-tasks";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function addTask(projectId: string, status = "to-do") {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Task",
      status,
      number: null,
    })
    .returning();
  return task;
}

async function relate(
  sourceTaskId: string,
  targetTaskId: string,
  relationType = "subtask",
) {
  const [relation] = await db
    .insert(schema.taskRelationTable)
    .values({
      sourceTaskId,
      targetTaskId,
      relationType,
    })
    .returning();
  return relation;
}

async function countsFor(projectId: string, taskId: string) {
  const { data } = await getTasks(projectId);
  return [
    ...data.columns.flatMap((c) => c.tasks),
    ...data.plannedTasks,
    ...data.archivedTasks,
  ].find((task) => task.id === taskId)?.subtaskCounts;
}

describe("API integration: subtask counters", () => {
  beforeEach(resetTestDatabase);

  it("counts direct children across filters and pagination, excluding other relations and incoming parents", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const parent = await addTask(project.id);
    const child = await addTask(project.id, "done");
    const grandchild = await addTask(project.id, "done");
    const other = await addTask(project.id, "in-progress");
    await relate(parent.id, child.id);
    await relate(child.id, grandchild.id);
    await relate(parent.id, other.id, "blocks");
    await relate(other.id, parent.id);
    await db
      .update(schema.taskTable)
      .set({ description: "- [x] Checklist\n- [ ] Checklist" })
      .where(eq(schema.taskTable.id, parent.id));

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/task/tasks/${project.id}?status=to-do&limit=1&page=1`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const tasks = body.data.columns.flatMap(
      (column: { tasks: unknown[] }) => column.tasks,
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: parent.id,
      subtaskCounts: { completed: 1, total: 1 },
    });
  });

  it("uses the child's final columns across projects and includes planned and archived children", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const other = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db
      .update(schema.columnTable)
      .set({ isFinal: false })
      .where(eq(schema.columnTable.id, other.columns.done.id));
    await db.insert(schema.columnTable).values({
      projectId: other.project.id,
      name: "Shipped",
      slug: "shipped",
      isFinal: true,
    });
    const parent = await addTask(project.id, "planned");
    for (const status of ["shipped", "done", "planned", "archived"]) {
      const child = await addTask(other.project.id, status);
      await relate(parent.id, child.id);
    }
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 1,
      total: 4,
    });
    await db
      .update(schema.taskTable)
      .set({ status: "archived" })
      .where(eq(schema.taskTable.id, parent.id));
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 1,
      total: 4,
    });
  });

  it("returns zero for empty tasks and reflects completion, reopening, unlinking, and deletion", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    expect(
      (await getTasks(project.id)).data.columns.every(
        (c) => c.tasks.length === 0,
      ),
    ).toBe(true);
    const parent = await addTask(project.id);
    const child = await addTask(project.id);
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 0,
      total: 0,
    });
    const relation = await relate(parent.id, child.id);
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 0,
      total: 1,
    });
    await updateTaskStatus({
      id: child.id,
      status: "done",
      currentUserId: member.user.id,
    });
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 1,
      total: 1,
    });
    await updateTaskStatus({
      id: child.id,
      status: "to-do",
      currentUserId: member.user.id,
    });
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 0,
      total: 1,
    });
    await db
      .delete(schema.taskRelationTable)
      .where(eq(schema.taskRelationTable.id, relation.id));
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 0,
      total: 0,
    });
    await relate(parent.id, child.id);
    await deleteTask(child.id, member.user.id);
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 0,
      total: 0,
    });
  });

  it("excludes cross-workspace relations and private-project counts on public boards", async () => {
    const member = await createWorkspaceMember();
    const stranger = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const privateProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const foreignProject = await createProjectFixture({
      workspaceId: stranger.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    const parent = await addTask(project.id);
    const publicChild = await addTask(project.id, "done");
    const privateChild = await addTask(privateProject.project.id, "done");
    const foreignChild = await addTask(foreignProject.project.id, "done");
    await relate(parent.id, publicChild.id);
    await relate(parent.id, privateChild.id);
    // Simulate a legacy malformed relation; it must not cross the workspace boundary.
    await relate(parent.id, foreignChild.id);
    expect(await countsFor(project.id, parent.id)).toEqual({
      completed: 2,
      total: 2,
    });
    const publicBoard = await getPublicProject(project.id);
    expect(
      publicBoard.columns
        .flatMap((c) => c.tasks)
        .find((t) => t.id === parent.id)?.subtaskCounts,
    ).toEqual({ completed: 1, total: 1 });
  });
  it("refreshes a parent board when a child in another project is completed or deleted", async () => {
    const member = await createWorkspaceMember();
    const parentProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const childProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const parent = await addTask(parentProject.project.id);
    const child = await addTask(childProject.project.id);
    await relate(parent.id, child.id);
    await initializeWebSocketAdapter();
    const send = vi.fn();
    const connection = addConnection(
      parentProject.project.id,
      { send } as never,
      member.user.id,
      "other-window",
    );
    try {
      await eventContext.run({ initiatorId: "other-window" }, () =>
        updateTaskStatus({
          id: child.id,
          status: "done",
          currentUserId: member.user.id,
        }),
      );
      await vi.waitFor(() => expect(send).toHaveBeenCalled());
      expect(JSON.parse(send.mock.calls[0][0])).toEqual({
        type: "TASK_RELATION_UPDATED",
        projectId: parentProject.project.id,
        taskId: "",
      });
      send.mockClear();
      await eventContext.run({ initiatorId: "other-window" }, () =>
        deleteTask(child.id, member.user.id),
      );
      await vi.waitFor(() => expect(send).toHaveBeenCalled());
      expect(JSON.parse(send.mock.calls[0][0])).toEqual({
        type: "TASK_RELATION_UPDATED",
        projectId: parentProject.project.id,
        taskId: "",
      });
    } finally {
      removeConnection(parentProject.project.id, connection);
      await shutdownWebSocketAdapter();
    }
  });
  it("refreshes parent boards when a child's column is marked final or reopened", async () => {
    const member = await createWorkspaceMember();
    const parentProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const childProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const parent = await addTask(parentProject.project.id);
    const child = await addTask(childProject.project.id, "done");
    await relate(parent.id, child.id);
    await initializeWebSocketAdapter();
    const send = vi.fn();
    const connection = addConnection(
      parentProject.project.id,
      { send } as never,
      member.user.id,
      "same-window",
    );
    try {
      for (const isFinal of [false, true]) {
        send.mockClear();
        await eventContext.run({ initiatorId: "same-window" }, () =>
          updateColumn(childProject.columns.done.id, { isFinal }),
        );
        await vi.waitFor(() => expect(send).toHaveBeenCalled());
        expect(JSON.parse(send.mock.calls[0][0])).toEqual({
          type: "TASK_RELATION_UPDATED",
          projectId: parentProject.project.id,
          taskId: "",
        });
        expect(await countsFor(parentProject.project.id, parent.id)).toEqual({
          completed: isFinal ? 1 : 0,
          total: 1,
        });
      }
    } finally {
      removeConnection(parentProject.project.id, connection);
      await shutdownWebSocketAdapter();
    }
  });

  it("refreshes parent boards after the bulk API deletes children", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const parentProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const childProject = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const parent = await addTask(parentProject.project.id);
    const child = await addTask(childProject.project.id);
    const secondChild = await addTask(childProject.project.id);
    await relate(parent.id, child.id);
    await relate(parent.id, secondChild.id);
    await initializeWebSocketAdapter();
    const send = vi.fn();
    const connection = addConnection(
      parentProject.project.id,
      { send } as never,
      member.user.id,
      "other-window",
    );
    try {
      mockAuthenticatedSession(member.user);
      const { app } = createApp();
      const response = await app.request("/api/task/bulk", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskIds: [child.id, secondChild.id],
          operation: "delete",
        }),
      });
      expect(response.status).toBe(200);
      await vi.waitFor(() => expect(send).toHaveBeenCalled());
      expect(JSON.parse(send.mock.calls[0][0])).toEqual({
        type: "TASK_RELATION_UPDATED",
        projectId: parentProject.project.id,
        taskId: "",
      });
      expect(await countsFor(parentProject.project.id, parent.id)).toEqual({
        completed: 0,
        total: 0,
      });
    } finally {
      removeConnection(parentProject.project.id, connection);
      await shutdownWebSocketAdapter();
    }
  });
});
