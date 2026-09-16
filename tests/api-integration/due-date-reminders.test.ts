import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendDueDateReminder } = vi.hoisted(() => ({
  sendDueDateReminder: vi.fn<
    (
      config: unknown,
      taskId: string,
      projectId: string,
      leadTimeMinutes: number,
      dueDate: Date,
    ) => Promise<boolean>
  >(async () => true),
}));

vi.mock(
  "../../apps/api/src/plugins/generic-webhook/events",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../apps/api/src/plugins/generic-webhook/events")
      >();
    return { ...actual, sendDueDateReminder };
  },
);

const { default: db, schema } = await import("../../apps/api/src/database");
const { checkDueDateReminders } = await import(
  "../../apps/api/src/scheduler/due-date-reminders"
);
const { checkProjectWebhookReminders } = await import(
  "../../apps/api/src/scheduler/project-webhook-reminders"
);
const { resetTestDatabase } = await import("./helpers/database");
const { createProjectFixture, createWorkspaceMember } = await import(
  "./helpers/fixtures"
);

const MINUTE_MS = 60 * 1000;
const DEFAULT_LEAD_TIME_MINUTES = 1440;

// Both schedulers fire when `dueDate - leadTime` lands in the trailing
// REMINDER_WINDOW_MINUTES. Sitting five minutes inside keeps the fixture off
// both edges of that window regardless of how long the suite takes to run.
function dueDateInsideReminderWindow() {
  return new Date(Date.now() + (DEFAULT_LEAD_TIME_MINUTES - 5) * MINUTE_MS);
}

type Scene = Awaited<ReturnType<typeof seedScene>>;

async function seedScene() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });

  return { user, workspace, project, columns };
}

// task_project_number_unique means every task in a project needs its own number.
let nextTaskNumber = 1;

async function seedTask(
  scene: Scene,
  {
    status,
    column = scene.columns.todo,
    dueDate = dueDateInsideReminderWindow(),
  }: {
    status: string;
    column?: Scene["columns"]["todo"];
    dueDate?: Date;
  },
) {
  const number = nextTaskNumber++;

  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: scene.project.id,
      columnId: column.id,
      userId: scene.user.id,
      title: `Task ${number}`,
      number,
      status,
      dueDate,
    })
    .returning();

  return task;
}

function notificationsFor(taskId: string) {
  return db
    .select()
    .from(schema.notificationTable)
    .where(eq(schema.notificationTable.resourceId, taskId));
}

function remindersSentFor(taskId: string) {
  return db
    .select()
    .from(schema.taskReminderSentTable)
    .where(eq(schema.taskReminderSentTable.taskId, taskId));
}

describe("due date reminders", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    nextTaskNumber = 1;
    sendDueDateReminder.mockClear();
  });

  it("notifies the assignee about an open task inside the window", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, { status: "to-do" });

    await checkDueDateReminders();

    const notifications = await notificationsFor(task.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("due_date_reminder");
    expect(notifications[0]?.userId).toBe(scene.user.id);
    expect(await remindersSentFor(task.id)).toHaveLength(1);
  });

  it("stays silent about an archived task with the same due date", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, { status: "archived" });

    await checkDueDateReminders();

    expect(await notificationsFor(task.id)).toHaveLength(0);
    expect(await remindersSentFor(task.id)).toHaveLength(0);
  });

  it("skips only the archived task when both are due", async () => {
    const scene = await seedScene();
    const open = await seedTask(scene, { status: "to-do" });
    const archived = await seedTask(scene, { status: "archived" });

    await checkDueDateReminders();

    const notifications = await db.select().from(schema.notificationTable);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.resourceId).toBe(open.id);
    expect(await notificationsFor(archived.id)).toHaveLength(0);
  });

  it("still notifies about planned tasks, which are not archived", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, { status: "planned" });

    await checkDueDateReminders();

    expect(await notificationsFor(task.id)).toHaveLength(1);
  });

  it("stays silent about a task in a final column", async () => {
    const scene = await seedScene();
    const task = await seedTask(scene, {
      status: "done",
      column: scene.columns.done,
    });

    await checkDueDateReminders();

    expect(await notificationsFor(task.id)).toHaveLength(0);
  });
});

describe("project webhook due date reminders", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    nextTaskNumber = 1;
    sendDueDateReminder.mockClear();
  });

  async function seedWebhookIntegration(projectId: string) {
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId,
        type: "generic-webhook",
        isActive: true,
        config: JSON.stringify({
          webhookUrl: "https://hooks.example.com/kaneo",
          events: { dueDateReminder: true },
        }),
      })
      .returning();

    return integration;
  }

  function remindedTaskIds() {
    return sendDueDateReminder.mock.calls.map(([, taskId]) => taskId);
  }

  it("posts a reminder for an open task inside the window", async () => {
    const scene = await seedScene();
    await seedWebhookIntegration(scene.project.id);
    const task = await seedTask(scene, { status: "to-do" });

    await checkProjectWebhookReminders();

    expect(remindedTaskIds()).toEqual([task.id]);
  });

  it("skips only the archived task when both are due", async () => {
    const scene = await seedScene();
    const integration = await seedWebhookIntegration(scene.project.id);
    const open = await seedTask(scene, { status: "to-do" });
    const archived = await seedTask(scene, { status: "archived" });

    await checkProjectWebhookReminders();

    expect(remindedTaskIds()).toEqual([open.id]);
    expect(await remindersSentFor(archived.id)).toHaveLength(0);
    expect(await remindersSentFor(open.id)).toEqual([
      expect.objectContaining({
        reminderType: `generic_webhook:${integration.id}`,
      }),
    ]);
  });
});
