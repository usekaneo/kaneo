import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import reorderTasks from "../../apps/api/src/task/controllers/reorder-tasks";
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
describe("atomic card reordering", () => {
  it("preserves fields edited since the board snapshot", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Another person's new title",
        description: "latest text",
        priority: "urgent",
        status: "to-do",
        position: 3,
      })
      .returning();
    await reorderTasks(
      project.id,
      [{ id: task.id, position: 1, status: "in-progress" }],
      user.id,
    );
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({
      title: task.title,
      description: task.description,
      priority: task.priority,
      position: 1,
      status: "in-progress",
    });
    expect(
      publish.mock.calls.filter(([event]) => event === "tasks.reordered"),
    ).toHaveLength(1);
  });
  it("rejects a card in another project without changing any positions", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const a = await createProjectFixture({ workspaceId: workspace.id });
    const b = await createProjectFixture({ workspaceId: workspace.id });
    const tasks = await db
      .insert(schema.taskTable)
      .values([
        { projectId: a.project.id, title: "a", status: "to-do", position: 3 },
        { projectId: b.project.id, title: "b", status: "to-do", position: 4 },
      ])
      .returning();
    await expect(
      reorderTasks(
        a.project.id,
        tasks.map((task) => ({ id: task.id, position: 0 })),
        user.id,
      ),
    ).rejects.toThrow("Tasks must belong");
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, tasks[0].id),
        })
      )?.position,
    ).toBe(3);
    expect(publish).not.toHaveBeenCalled();
  });
});
