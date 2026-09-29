import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
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
