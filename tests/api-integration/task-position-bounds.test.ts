import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import createTask from "../../apps/api/src/task/controllers/create-task";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import { MAX_TASK_POSITION } from "../../apps/api/src/task/controllers/next-task-position";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
});
async function setup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Original",
      status: "to-do",
      number: 1,
      position: 1,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
  return { ...member, project, columns, task };
}

describe("task position bounds and legacy recovery", () => {
  it.each([-1, 0.5, 2_147_483_647, 2_147_483_648, Number.MAX_SAFE_INTEGER])(
    "rejects unsafe position %s before updating any task field",
    async (position) => {
      const { project, task } = await setup();
      const { app } = createApp();
      const response = await app.request(`/api/task/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Should not write",
          description: "",
          status: "to-do",
          priority: "low",
          projectId: project.id,
          position,
        }),
      });
      expect(response.status).toBe(400);
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      ).toMatchObject({ title: "Original", position: 1 });
    },
  );

  it("accepts bounded positions and recovers legacy overflow without touching other columns", async () => {
    const { project, columns, task, user } = await setup();
    await db
      .update(schema.taskTable)
      .set({ position: 2_147_483_647 })
      .where(eq(schema.taskTable.id, task.id));
    const [earlier, other] = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: project.id,
          columnId: columns.todo.id,
          title: "Earlier",
          number: 2,
          status: "to-do",
          position: 10,
        },
        {
          projectId: project.id,
          columnId: columns.done.id,
          title: "Other column",
          number: 3,
          status: "done",
          position: 999,
        },
      ])
      .returning();
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 3 })
      .where(eq(schema.projectTable.id, project.id));
    const appended = await createTask({
      projectId: project.id,
      currentUserId: user.id,
      title: "Appended",
      status: "to-do",
    });
    expect(appended.position).toBe(3);
    const rows = await db.query.taskTable.findMany({
      orderBy: asc(schema.taskTable.position),
    });
    expect(rows.map((row) => [row.id, row.position])).toEqual([
      [earlier.id, 1],
      [task.id, 2],
      [appended.id, 3],
      [other.id, 999],
    ]);
  });

  it("repairs virtual-status tasks and serializes concurrent appends", async () => {
    const { project, task, user } = await setup();
    await db
      .update(schema.taskTable)
      .set({ status: "planned", columnId: null, position: MAX_TASK_POSITION })
      .where(eq(schema.taskTable.id, task.id));
    const added = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createTask({
          projectId: project.id,
          currentUserId: user.id,
          title: `New ${index}`,
          status: "planned",
        }),
      ),
    );
    expect(added.map((row) => row.position).sort()).toEqual([2, 3, 4, 5]);
    expect(new Set(added.map((row) => row.number)).size).toBe(4);
  });

  it("recovers an overflowed destination when moving a task", async () => {
    const { project, user, workspace, task } = await setup();
    const { project: destination, columns } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [poisoned] = await db
      .insert(schema.taskTable)
      .values({
        projectId: destination.id,
        columnId: columns.todo.id,
        title: "Existing",
        status: "to-do",
        position: 2_147_483_647,
      })
      .returning();
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 1 })
      .where(eq(schema.projectTable.id, destination.id));
    const result = await moveTask({
      taskId: task.id,
      destinationProjectId: destination.id,
      currentUserId: user.id,
    });
    expect(result.task).toMatchObject({
      projectId: destination.id,
      position: 2,
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, poisoned.id),
      }),
    ).toHaveProperty("position", 1);
    expect(result.sourceProjectId).toBe(project.id);
  });
});
