import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
const publish = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  publish.mockResolvedValue(undefined);
});
it("validates every destination before committing any project", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const a = await createProjectFixture({ workspaceId: workspace.id });
  const b = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .delete(schema.columnTable)
    .where(eq(schema.columnTable.id, b.columns.inProgress.id));
  const tasks = await db
    .insert(schema.taskTable)
    .values([
      { projectId: a.project.id, title: "a", status: "to-do" },
      { projectId: b.project.id, title: "b", status: "to-do" },
    ])
    .returning();
  await expect(
    bulkUpdateTasks({
      taskIds: tasks.map((task) => task.id),
      operation: "updateStatus",
      value: "in-progress",
      userId: user.id,
    }),
  ).rejects.toThrow("Invalid status");
  expect(
    (await db.query.taskTable.findMany()).map((task) => task.status),
  ).toEqual(["to-do", "to-do"]);
  expect(publish).not.toHaveBeenCalled();
});

it("commits every project before publishing successful status changes", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const a = await createProjectFixture({ workspaceId: workspace.id });
  const b = await createProjectFixture({ workspaceId: workspace.id });
  const tasks = await db
    .insert(schema.taskTable)
    .values([
      { projectId: a.project.id, title: "a", status: "to-do" },
      { projectId: b.project.id, title: "b", status: "to-do" },
    ])
    .returning();
  publish.mockImplementation(async () => {
    expect(
      (
        await db
          .select({ status: schema.taskTable.status })
          .from(schema.taskTable)
      ).map((task) => task.status),
    ).toEqual(["in-progress", "in-progress"]);
  });
  expect(
    await bulkUpdateTasks({
      taskIds: tasks.map((task) => task.id),
      operation: "updateStatus",
      value: "in-progress",
      userId: user.id,
    }),
  ).toMatchObject({ updatedCount: 2 });
  for (const task of tasks)
    expect(publish).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        taskId: task.id,
        oldStatus: "to-do",
        newStatus: "in-progress",
      }),
    );
});

it("uses the locked prior status when a concurrent edit rewrites a no-op snapshot", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "concurrent", status: "to-do" })
    .returning();
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
    async (apply, config) => {
      await db
        .update(schema.taskTable)
        .set({ status: "in-progress" })
        .where(eq(schema.taskTable.id, task.id));
      return transaction(apply, config);
    },
  );
  await bulkUpdateTasks({
    taskIds: [task.id],
    operation: "updateStatus",
    value: "to-do",
    userId: user.id,
  });
  expect(publish).toHaveBeenCalledWith(
    "task.status_changed",
    expect.objectContaining({
      taskId: task.id,
      oldStatus: "in-progress",
      newStatus: "to-do",
    }),
  );
});
