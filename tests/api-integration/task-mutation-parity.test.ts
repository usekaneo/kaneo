import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import updateTaskAssignee from "../../apps/api/src/task/controllers/update-task-assignee";
import updateTaskPriority from "../../apps/api/src/task/controllers/update-task-priority";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import updateTask from "../../apps/api/src/task/controllers/update-task";
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
afterEach(() => vi.restoreAllMocks());
it("full updates store title history, assignment events and reset reminders together", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const due = new Date("2030-01-01");
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "old",
      status: "to-do",
      priority: "low",
      dueDate: due,
      position: 0,
    })
    .returning();
  await db
    .insert(schema.taskReminderSentTable)
    .values({ taskId: task.id, reminderType: "due_today" });
  await updateTask(
    task.id,
    "new",
    "to-do",
    undefined,
    new Date("2030-02-01"),
    project.id,
    undefined,
    "low",
    0,
    user.id,
    user.id,
  );
  expect(await db.query.activityTable.findMany()).toEqual([
    expect.objectContaining({
      type: "title_changed",
      eventData: { oldTitle: "old", newTitle: "new" },
    }),
  ]);
  expect(await db.query.taskReminderSentTable.findMany()).toHaveLength(0);
  expect(publish).toHaveBeenCalledWith(
    "task.assignee_changed",
    expect.objectContaining({ newAssigneeId: user.id }),
  );
});
it("bulk due date updates clear claims and preserve claims for unchanged dates", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "task",
      status: "to-do",
      dueDate: new Date("2030-01-01"),
    })
    .returning();
  await db
    .insert(schema.taskReminderSentTable)
    .values({ taskId: task.id, reminderType: "due_today" });
  await bulkUpdateTasks({
    taskIds: [task.id],
    operation: "updateDueDate",
    value: "2030-01-01",
    userId: user.id,
  });
  expect(await db.query.taskReminderSentTable.findMany()).toHaveLength(1);
  await bulkUpdateTasks({
    taskIds: [task.id],
    operation: "updateDueDate",
    value: null,
    userId: user.id,
  });
  expect(await db.query.taskReminderSentTable.findMany()).toHaveLength(0);
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      })
    )?.dueDate,
  ).toBeNull();
});

it("a single-field write does not attribute another concurrent field change to its actor", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "old", priority: "low" })
    .returning();
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
    async (apply, config) => {
      await db
        .update(schema.taskTable)
        .set({ title: "concurrent title" })
        .where(eq(schema.taskTable.id, task.id));
      return transaction(apply, config);
    },
  );
  await updateTaskPriority({
    id: task.id,
    priority: "high",
    currentUserId: user.id,
  });
  expect(publish.mock.calls.map(([type]) => type)).toEqual([
    "task.priority_changed",
  ]);
});
it("bulk due dates use locked current dates before clearing reminder claims", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "date race",
      dueDate: new Date("2030-01-01"),
    })
    .returning();
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
    async (apply, config) => {
      await db
        .update(schema.taskTable)
        .set({ dueDate: new Date("2030-02-01") })
        .where(eq(schema.taskTable.id, task.id));
      await db
        .insert(schema.taskReminderSentTable)
        .values({ taskId: task.id, reminderType: "due_today" });
      return transaction(apply, config);
    },
  );
  await bulkUpdateTasks({
    taskIds: [task.id],
    operation: "updateDueDate",
    value: "2030-01-01",
    userId: user.id,
  });
  expect(await db.query.taskReminderSentTable.findMany()).toHaveLength(0);
  expect(publish).toHaveBeenCalledWith(
    "task.due_date_changed",
    expect.objectContaining({
      oldDueDate: new Date("2030-02-01"),
      newDueDate: new Date("2030-01-01"),
    }),
  );
});
it("bulk assignment resolves the assignee once and bulk status refreshes each project once", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: 3 }, (_, i) => ({
        projectId: project.id,
        title: `bulk-${i}`,
        number: i + 1,
        status: "to-do",
      })),
    )
    .returning();
  const nameLookup = vi.spyOn(getDatabase().query.userTable, "findFirst");
  await bulkUpdateTasks({
    taskIds: tasks.map((task) => task.id),
    operation: "updateAssignee",
    value: user.id,
    userId: user.id,
  });
  expect(nameLookup).toHaveBeenCalledTimes(1);
  publish.mockClear();
  await bulkUpdateTasks({
    taskIds: tasks.map((task) => task.id),
    operation: "updateStatus",
    value: "in-progress",
    userId: user.id,
  });
  expect(
    publish.mock.calls.filter(([type]) => type === "task-relation.refresh"),
  ).toHaveLength(1);
});

it.each(["single", "bulk"])(
  "%s priority writes publish the actual overwritten priority",
  async (mode) => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "priority race",
        priority: "low",
      })
      .returning();
    const transaction = db.transaction.bind(db);
    vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
      async (apply, config) => {
        await db
          .update(schema.taskTable)
          .set({ priority: "high" })
          .where(eq(schema.taskTable.id, task.id));
        return transaction(apply, config);
      },
    );
    if (mode === "single")
      await updateTaskPriority({
        id: task.id,
        priority: "low",
        currentUserId: user.id,
      });
    else
      await bulkUpdateTasks({
        taskIds: [task.id],
        operation: "updatePriority",
        value: "low",
        userId: user.id,
      });
    expect(publish).toHaveBeenCalledWith(
      "task.priority_changed",
      expect.objectContaining({ oldPriority: "high", newPriority: "low" }),
    );
  },
);

it("validates status and assignment without a second pool client inside the mutation transaction", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "pool safety" })
    .returning();
  let locked = false;
  const select = getDatabase().select.bind(getDatabase());
  vi.spyOn(getDatabase(), "select").mockImplementation((...args) => {
    if (locked)
      throw new Error("Validation attempted a second pool connection");
    return select(...args);
  });
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementation((apply, config) =>
    transaction(async (tx) => {
      locked = true;
      try {
        return await apply(tx);
      } finally {
        locked = false;
      }
    }, config),
  );
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  await updateTaskAssignee({
    id: task.id,
    userId: user.id,
    currentUserId: user.id,
  });
  expect(
    await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    }),
  ).toMatchObject({ status: "done", userId: user.id });
});

it.each(["single", "full"])(
  "%s status repairs notify clients without recording a status transition",
  async (mode) => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const column = await db.query.columnTable.findFirst({
      where: eq(schema.columnTable.slug, "to-do"),
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Legacy task",
        status: "to-do",
        columnId: null,
      })
      .returning();
    if (mode === "single")
      await updateTaskStatus({
        id: task.id,
        status: task.status,
        currentUserId: user.id,
      });
    else
      await updateTask(
        task.id,
        task.title,
        task.status,
        undefined,
        undefined,
        project.id,
        undefined,
        task.priority,
        task.position,
        undefined,
        user.id,
      );
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.columnId,
    ).toBe(column?.id);
    expect(publish).toHaveBeenCalledWith(
      "task.updated",
      expect.objectContaining({ taskId: task.id, projectId: project.id }),
    );
    expect(publish).toHaveBeenCalledWith(
      "task-relation.refresh",
      expect.objectContaining({ projectId: project.id }),
    );
    expect(
      publish.mock.calls.some(([type]) => type === "task.status_changed"),
    ).toBe(false);
  },
);

it("rejects a bulk due-date update after a task moves out of the authorized project", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const other = await createWorkspaceMember();
  const { project: foreign } = await createProjectFixture({
    workspaceId: other.workspace.id,
  });
  const dueDate = new Date("2030-01-01");
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Moved task", dueDate })
    .returning();
  await db
    .insert(schema.taskReminderSentTable)
    .values({ taskId: task.id, reminderType: "due_today" });
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
    async (apply, config) => {
      await db
        .update(schema.taskTable)
        .set({ projectId: foreign.id })
        .where(eq(schema.taskTable.id, task.id));
      return transaction(apply, config);
    },
  );
  await expect(
    bulkUpdateTasks({
      taskIds: [task.id],
      operation: "updateDueDate",
      value: null,
      userId: user.id,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      })
    )?.dueDate,
  ).toEqual(dueDate);
  expect(await db.query.taskReminderSentTable.findMany()).toHaveLength(1);
  expect(publish).not.toHaveBeenCalled();
});
