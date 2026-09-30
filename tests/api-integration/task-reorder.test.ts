import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
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
    const result = await reorderTasks(
      project.id,
      [{ id: task.id, position: 1, status: "in-progress" }],
      user.id,
    );
    expect(result).toEqual([
      { id: task.id, position: 1, status: "in-progress" },
    ]);
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

it("atomically reorders more than 1,000 supported cards", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: 1001 }, (_, i) => ({
        projectId: project.id,
        title: `card-${i}`,
        number: i + 1,
        position: i,
        status: "to-do",
      })),
    )
    .returning({ id: schema.taskTable.id });
  const result = await reorderTasks(
    project.id,
    tasks.map((task, i) => ({ id: task.id, position: 1000 - i })),
    user.id,
  );
  expect(result).toHaveLength(1001);
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, tasks[0].id),
      })
    )?.position,
  ).toBe(1000);
});

it("rejects a second drag from a stale column snapshot without duplicating positions", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: 4 }, (_, position) => ({
        projectId: project.id,
        title: `card-${position}`,
        number: position + 1,
        position,
        status: "to-do",
      })),
    )
    .returning();
  const expected = tasks.map((task) => ({
    id: task.id,
    position: task.position,
    status: task.status,
  }));
  await reorderTasks(
    project.id,
    tasks.map((task, index) => ({
      id: task.id,
      position: index === 0 ? 3 : index - 1,
    })),
    user.id,
    expected,
  );
  publish.mockClear();
  await expect(
    reorderTasks(
      project.id,
      [{ id: tasks[1].id, position: 3 }],
      user.id,
      expected,
    ),
  ).rejects.toMatchObject({ status: 409 });
  const current = await db
    .select()
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, project.id));
  expect(new Set(current.map((task) => task.position)).size).toBe(4);
  expect(publish).not.toHaveBeenCalled();
});

it("rejects a legacy full update superseded by an atomic reorder", async () => {
  const { default: updateTask } =
    await import("../../apps/api/src/task/controllers/update-task");
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "card",
      status: "to-do",
      position: 0,
      priority: "low",
    })
    .returning();
  const transaction = getDatabase().transaction.bind(getDatabase());
  const intercepted = vi
    .spyOn(getDatabase(), "transaction")
    .mockImplementationOnce(async (apply, config) => {
      await reorderTasks(project.id, [{ id: task.id, position: 2 }], user.id);
      return transaction(apply, config);
    });
  try {
    await expect(
      updateTask(
        task.id,
        task.title,
        task.status,
        undefined,
        undefined,
        project.id,
        undefined,
        task.priority,
        1,
        undefined,
        user.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.position,
    ).toBe(2);
  } finally {
    intercepted.mockRestore();
  }
});
