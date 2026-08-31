import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import type { ReorderTask } from "../../apps/api/src/task/schema";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

function reorderRequest(projectId: string, tasks: ReorderTask[]) {
  const { app } = createApp();
  return app.request(`/api/task/reorder/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks }),
  });
}

async function seedTasks(
  projectId: string,
  columnId: string,
  status: string,
  titles: string[],
) {
  const inserted: (typeof schema.taskTable.$inferSelect)[] = [];

  for (const [index, title] of titles.entries()) {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId,
        title,
        status,
        columnId,
        priority: "medium",
        number: index + 1,
        position: index,
      })
      .returning();

    if (task) inserted.push(task);
  }

  return inserted;
}

function readTasks(projectId: string) {
  return db
    .select({
      id: schema.taskTable.id,
      title: schema.taskTable.title,
      status: schema.taskTable.status,
      columnId: schema.taskTable.columnId,
      position: schema.taskTable.position,
    })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, projectId))
    .orderBy(asc(schema.taskTable.status), asc(schema.taskTable.position));
}

describe("API integration: task reorder", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("applies a whole same-column reorder in one request", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [first, second, third] = await seedTasks(
      project.id,
      columns.todo.id,
      "to-do",
      ["First", "Second", "Third"],
    );

    mockAuthenticatedSession(member.user);

    // "Third" dragged to the top, which renumbers the two above it.
    const response = await reorderRequest(project.id, [
      { id: third.id, status: "to-do", position: 0 },
      { id: first.id, status: "to-do", position: 1 },
      { id: second.id, status: "to-do", position: 2 },
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      updatedCount: 3,
    });

    const tasks = await readTasks(project.id);
    expect(tasks.map((task) => task.title)).toEqual([
      "Third",
      "First",
      "Second",
    ]);
    expect(tasks.map((task) => task.position)).toEqual([0, 1, 2]);
  });

  it("reorders a column larger than a single SQL statement's chunk", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    // The board is served on a single page, so a column really can be this
    // long, and dragging its top card to the bottom renumbers every task in it.
    // There is deliberately no cap on the payload for exactly this reason.
    const total = 1500;
    const inserted = await db
      .insert(schema.taskTable)
      .values(
        Array.from({ length: total }, (_, index) => ({
          projectId: project.id,
          title: `Task ${index}`,
          status: "to-do",
          columnId: columns.todo.id,
          priority: "medium",
          number: index + 1,
          position: index,
        })),
      )
      .returning({
        id: schema.taskTable.id,
        position: schema.taskTable.position,
      });

    const ordered = [...inserted].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );

    mockAuthenticatedSession(member.user);

    // Top card to the bottom: every task shifts up one slot.
    const [moved, ...rest] = ordered;
    const response = await reorderRequest(project.id, [
      ...rest.map((task, index) => ({
        id: task.id,
        status: "to-do",
        position: index,
      })),
      { id: moved.id, status: "to-do", position: total - 1 },
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      updatedCount: total,
    });

    const tasks = await readTasks(project.id);
    expect(tasks).toHaveLength(total);
    expect(tasks.at(0)?.id).toBe(rest[0]?.id);
    expect(tasks.at(-1)?.id).toBe(moved.id);
    // Positions stay dense, with no duplicates or gaps.
    expect(tasks.map((task) => task.position)).toEqual(
      Array.from({ length: total }, (_, index) => index),
    );
  });

  it("moves a task to another column and syncs its column id", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Movable",
    ]);

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "in-progress", position: 0 },
    ]);

    expect(response.status).toBe(200);

    const [updated] = await readTasks(project.id);
    expect(updated.status).toBe("in-progress");
    // `status` is the source of truth for the board, but `columnId` is what the
    // relational queries join on, so a reorder has to move both together.
    expect(updated.columnId).toBe(columns.inProgress.id);
  });

  it("records a status change activity only for the task that changed column", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [moved, neighbour] = await seedTasks(
      project.id,
      columns.todo.id,
      "to-do",
      ["Moved", "Neighbour"],
    );

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: moved.id, status: "done", position: 0 },
      // The neighbour only slides up a slot; that is not user-visible history.
      { id: neighbour.id, status: "to-do", position: 0 },
    ]);

    expect(response.status).toBe(200);

    // Events are published without awaiting their subscribers.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const activities = await db
      .select({
        taskId: schema.activityTable.taskId,
        type: schema.activityTable.type,
      })
      .from(schema.activityTable)
      .where(eq(schema.activityTable.type, "status_changed"));

    expect(activities).toHaveLength(1);
    expect(activities[0]?.taskId).toBe(moved.id);
  });

  it("skips tasks already in the requested place", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [first, second] = await seedTasks(
      project.id,
      columns.todo.id,
      "to-do",
      ["First", "Second"],
    );

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: first.id, status: "to-do", position: 0 },
      { id: second.id, status: "to-do", position: 1 },
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ updatedCount: 0 });
  });

  it("accepts the virtual backlog statuses and clears the column id", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Backlogged",
    ]);

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "planned", position: 0 },
    ]);

    expect(response.status).toBe(200);

    const [updated] = await readTasks(project.id);
    expect(updated.status).toBe("planned");
    expect(updated.columnId).toBeNull();
  });

  it("rejects a status that is not a column of the project", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Task",
    ]);

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "not-a-column", position: 0 },
    ]);

    expect(response.status).toBe(400);

    const [unchanged] = await readTasks(project.id);
    expect(unchanged.status).toBe("to-do");
  });

  it("rejects a task from another project without applying the batch", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "target",
    });
    const other = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "other",
    });

    const [mine] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Mine",
    ]);
    const [foreign] = await seedTasks(
      other.project.id,
      other.columns.todo.id,
      "to-do",
      ["Foreign"],
    );

    mockAuthenticatedSession(member.user);

    // The legitimate id comes first, so a per-row loop would already have
    // written it by the time it reached the foreign one.
    const response = await reorderRequest(project.id, [
      { id: mine.id, status: "done", position: 0 },
      { id: foreign.id, status: "done", position: 1 },
    ]);

    expect(response.status).toBe(400);

    const [unchanged] = await readTasks(project.id);
    expect(unchanged.status).toBe("to-do");
    expect(unchanged.position).toBe(0);
  });

  it("rejects a duplicated task id", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Task",
    ]);

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "to-do", position: 0 },
      { id: task.id, status: "to-do", position: 1 },
    ]);

    expect(response.status).toBe(400);
  });

  it("rejects an unknown task id", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: "does-not-exist", status: "to-do", position: 0 },
    ]);

    expect(response.status).toBe(404);
  });

  it("rejects an empty payload", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, []);

    expect(response.status).toBe(400);
  });

  it("rejects a fractional position", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Task",
    ]);

    mockAuthenticatedSession(member.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "to-do", position: 1.5 },
    ]);

    expect(response.status).toBe(400);
  });

  it("rejects a member without task update permission", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project, columns } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Task",
    ]);

    mockAuthenticatedSession(viewer.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "done", position: 0 },
    ]);

    expect(response.status).toBe(403);
  });

  it("rejects a caller outside the project's workspace", async () => {
    const owner = await createWorkspaceMember({ role: "admin" });
    const outsider = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Task",
    ]);

    mockAuthenticatedSession(outsider.user);

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "done", position: 0 },
    ]);

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated reorder requests", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await seedTasks(project.id, columns.todo.id, "to-do", [
      "Task",
    ]);

    mockAnonymousSession();

    const response = await reorderRequest(project.id, [
      { id: task.id, status: "done", position: 0 },
    ]);

    expect(response.status).toBe(401);
  });
});
