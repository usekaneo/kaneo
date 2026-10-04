import { and, eq, ne } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { createNextOccurrence } from "../../apps/api/src/task/recurrence/create-next-occurrence";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const weekly = { frequency: "weekly", interval: 1, timeZone: "UTC" } as const;

async function seedProject() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  return { member, project, columns, app: createApp().app };
}

async function seedTask(
  projectId: string,
  columnId: string,
  overrides: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const [project] = await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, projectId))
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      columnId,
      title: "Send the weekly report",
      status: "to-do",
      priority: "high",
      number: project?.lastTaskNumber ?? 1,
      position: 1,
      startDate: new Date("2026-03-09T00:00:00.000Z"),
      dueDate: new Date("2026-03-10T00:00:00.000Z"),
      recurrence: weekly,
      ...overrides,
    })
    .returning();
  if (!task) throw new Error("Failed to seed task");
  return task;
}

function request(
  app: Awaited<ReturnType<typeof seedProject>>["app"],
  method: string,
  path: string,
  body: unknown,
) {
  return app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function otherTasks(projectId: string, taskId: string) {
  return db.query.taskTable.findMany({
    where: and(
      eq(schema.taskTable.projectId, projectId),
      ne(schema.taskTable.id, taskId),
    ),
  });
}

async function waitForNextOccurrence(projectId: string, taskId: string) {
  return vi.waitFor(async () => {
    const [next] = await otherTasks(projectId, taskId);
    if (!next) throw new Error("No next occurrence yet");
    return next;
  });
}

describe("API integration: recurring tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("sets and clears a task's recurrence rule", async () => {
    const { project, columns, app } = await seedProject();
    const task = await seedTask(project.id, columns.todo.id, {
      recurrence: null,
    });

    const set = await request(app, "PUT", `/api/task/recurrence/${task.id}`, {
      recurrence: {
        frequency: "monthly",
        interval: 3,
        timeZone: "Europe/Madrid",
      },
    });
    expect(set.status).toBe(200);
    await expect(set.json()).resolves.toMatchObject({
      recurrence: {
        frequency: "monthly",
        interval: 3,
        timeZone: "Europe/Madrid",
      },
    });

    const cleared = await request(
      app,
      "PUT",
      `/api/task/recurrence/${task.id}`,
      { recurrence: null },
    );
    expect(cleared.status).toBe(200);
    const stored = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(stored?.recurrence).toBeNull();
  });

  it("creates a task that already repeats", async () => {
    const { project, app } = await seedProject();
    const recurrence = { ...weekly, weekdays: [1, 4] };

    const created = await request(app, "POST", `/api/task/${project.id}`, {
      title: "Water the plants",
      description: "",
      priority: "no-priority",
      status: "to-do",
      dueDate: "2026-03-10T00:00:00.000Z",
      recurrence,
    });
    expect(created.status).toBe(200);
    const task = await created.json();
    expect(task).toMatchObject({ recurrence });

    const stored = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(stored?.recurrence).toEqual(recurrence);

    const invalid = await request(app, "POST", `/api/task/${project.id}`, {
      title: "Water the plants",
      description: "",
      priority: "no-priority",
      status: "to-do",
      recurrence: { ...weekly, frequency: "daily", weekdays: [1] },
    });
    expect(invalid.status).toBe(400);
  });

  it("rejects invalid recurrence rules", async () => {
    const { project, columns, app } = await seedProject();
    const task = await seedTask(project.id, columns.todo.id);

    for (const recurrence of [
      { ...weekly, interval: 0 },
      { ...weekly, interval: 1.5 },
      { ...weekly, frequency: "hourly" },
      { ...weekly, timeZone: "Mars/Olympus" },
      { ...weekly, weekdays: [] },
      { ...weekly, weekdays: [1, 1] },
      { ...weekly, weekdays: [7] },
      { ...weekly, frequency: "daily", weekdays: [1] },
    ]) {
      const response = await request(
        app,
        "PUT",
        `/api/task/recurrence/${task.id}`,
        { recurrence },
      );
      expect(response.status).toBe(400);
    }
  });

  it("creates the next occurrence when the task is completed", async () => {
    const { member, project, columns, app } = await seedProject();
    const task = await seedTask(project.id, columns.inReview.id, {
      status: "in-review",
      userId: member.user.id,
    });
    await db.insert(schema.labelTable).values({
      name: "reports",
      color: "#22c55e",
      workspaceId: member.workspace.id,
      taskId: task.id,
    });
    const [field] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({ projectId: project.id, name: "Audience", type: "text" })
      .returning();
    if (!field) throw new Error("Failed to seed custom field");
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: task.id, fieldId: field.id, value: "Board" });

    const response = await request(app, "PUT", `/api/task/status/${task.id}`, {
      status: "done",
    });
    expect(response.status).toBe(200);

    const next = await waitForNextOccurrence(project.id, task.id);
    expect(next).toMatchObject({
      title: task.title,
      status: "to-do",
      columnId: columns.todo.id,
      priority: "high",
      userId: member.user.id,
      number: 2,
      startDate: new Date("2026-03-16T00:00:00.000Z"),
      dueDate: new Date("2026-03-17T00:00:00.000Z"),
      recurrence: weekly,
    });

    const completed = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(completed).toMatchObject({ status: "done", recurrence: null });

    const labels = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, next.id),
    });
    expect(labels.map((label) => label.name)).toEqual(["reports"]);
    const values = await db.query.customFieldValueTable.findMany({
      where: eq(schema.customFieldValueTable.taskId, next.id),
    });
    expect(values.map((value) => value.value)).toEqual(["Board"]);
  });

  it("creates the next occurrence when a task is dragged or bulk-completed", async () => {
    const { project, columns, app } = await seedProject();
    const dragged = await seedTask(project.id, columns.todo.id);

    const reorder = await request(app, "POST", "/api/task/reorder", {
      projectId: project.id,
      tasks: [{ id: dragged.id, position: 0, status: "done" }],
    });
    expect(reorder.status).toBe(200);
    const afterDrag = await waitForNextOccurrence(project.id, dragged.id);

    const bulk = await request(app, "PATCH", "/api/task/bulk", {
      taskIds: [afterDrag.id],
      operation: "updateStatus",
      value: "done",
    });
    expect(bulk.status).toBe(200);
    await vi.waitFor(async () => {
      const tasks = await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, project.id),
      });
      expect(tasks).toHaveLength(3);
    });

    const open = await db.query.taskTable.findMany({
      where: and(
        eq(schema.taskTable.projectId, project.id),
        eq(schema.taskTable.status, "to-do"),
      ),
    });
    expect(open).toHaveLength(1);
    expect(open[0]?.dueDate).toEqual(new Date("2026-03-24T00:00:00.000Z"));
  });

  it("creates one next occurrence per completion", async () => {
    const { project, columns } = await seedProject();
    const task = await seedTask(project.id, columns.done.id, {
      status: "done",
    });

    const results = await Promise.all([
      createNextOccurrence(task.id, null),
      createNextOccurrence(task.id, null),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await otherTasks(project.id, task.id)).toHaveLength(1);
    // The losing claim rolls back, so it does not use up a task number.
    const [counter] = await db
      .select({ lastTaskNumber: schema.projectTable.lastTaskNumber })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(counter?.lastTaskNumber).toBe(2);

    // Reopening and completing the old task again does not repeat it twice.
    await db
      .update(schema.taskTable)
      .set({ status: "to-do", columnId: columns.todo.id })
      .where(eq(schema.taskTable.id, task.id));
    await db
      .update(schema.taskTable)
      .set({ status: "done", columnId: columns.done.id })
      .where(eq(schema.taskTable.id, task.id));
    await expect(createNextOccurrence(task.id, null)).resolves.toBeNull();
    expect(await otherTasks(project.id, task.id)).toHaveLength(1);
  });

  it("ignores tasks that are not completed or do not repeat", async () => {
    const { project, columns } = await seedProject();
    const open = await seedTask(project.id, columns.inProgress.id, {
      status: "in-progress",
    });
    await expect(createNextOccurrence(open.id, null)).resolves.toBeNull();

    const plain = await seedTask(project.id, columns.done.id, {
      status: "done",
      recurrence: null,
      number: 2,
    });
    await expect(createNextOccurrence(plain.id, null)).resolves.toBeNull();

    expect(
      await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, project.id),
      }),
    ).toHaveLength(2);
  });

  it("repeats from the completion date when the task has no due date", async () => {
    const { project, columns } = await seedProject();
    const task = await seedTask(project.id, columns.done.id, {
      status: "done",
      dueDate: null,
    });
    const before = Date.now();

    const next = await createNextOccurrence(task.id, null);

    expect(next?.startDate).toBeNull();
    const due = next?.dueDate?.getTime() ?? 0;
    expect(due).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    expect(due).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
  });

  it("repeats on the selected weekdays", async () => {
    const { project, columns, app } = await seedProject();
    // Due Tuesday 2026-03-10, repeating on Tuesdays and Thursdays.
    const task = await seedTask(project.id, columns.todo.id);
    const rule = { ...weekly, weekdays: [2, 4] };
    const set = await request(app, "PUT", `/api/task/recurrence/${task.id}`, {
      recurrence: rule,
    });
    expect(set.status).toBe(200);

    await request(app, "PUT", `/api/task/status/${task.id}`, {
      status: "done",
    });

    const next = await waitForNextOccurrence(project.id, task.id);
    expect(next).toMatchObject({
      startDate: new Date("2026-03-11T00:00:00.000Z"),
      dueDate: new Date("2026-03-12T00:00:00.000Z"),
      recurrence: rule,
    });
  });
});
