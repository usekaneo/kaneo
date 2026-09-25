import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { taskReminderSentTable } from "../../apps/api/src/database/schema";
import createNotification from "../../apps/api/src/notification/controllers/create-notification";
import { sendDueDateReminder } from "../../apps/api/src/plugins/generic-webhook/events";
import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import { checkProjectWebhookReminders } from "../../apps/api/src/scheduler/project-webhook-reminders";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({
    default: vi.fn().mockResolvedValue(undefined),
  }),
);
vi.mock("../../apps/api/src/plugins/generic-webhook/events", () => ({
  sendDueDateReminder: vi.fn().mockResolvedValue(true),
}));

async function seedReminder({
  dueDate = "2026-09-23T00:00:00.000Z",
  leadTimeMinutes = 14 * 60,
  completed = false,
  enabled = true,
}: {
  dueDate?: string;
  leadTimeMinutes?: number | null;
  completed?: boolean;
  enabled?: boolean;
} = {}) {
  const { user, workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const column = completed ? columns.done : columns.todo;
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      title: "Due all day",
      projectId: project.id,
      userId: user.id,
      columnId: column.id,
      status: column.slug,
      number: 1,
      dueDate: new Date(dueDate),
    })
    .returning();

  if (leadTimeMinutes !== null) {
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: user.id,
      dueDateReminderLeadTimeMinutes: leadTimeMinutes,
      dueDateReminderEnabled: enabled,
    });
  }
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "generic-webhook",
    config: JSON.stringify({
      url: "https://example.com/reminders",
      events: { dueDateReminder: enabled },
      ...(leadTimeMinutes === null
        ? {}
        : { dueDateReminderLeadTimeMinutes: leadTimeMinutes }),
    }),
  });
  return task;
}

async function checkAllReminders() {
  await checkDueDateReminders();
  await checkProjectWebhookReminders();
}

function expectNoDelivery() {
  expect(createNotification).not.toHaveBeenCalled();
  expect(sendDueDateReminder).not.toHaveBeenCalled();
}

describe("API integration: date-only reminders", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTestDatabase();
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [
      "2026-09-23T00:00:00.000Z",
      "2026-09-22T10:00:00.000Z",
      "2026-09-23T10:00:00.000Z",
    ],
    [
      "2026-09-23T00:00:00+02:00",
      "2026-09-22T10:00:00+02:00",
      "2026-09-23T10:00:00+02:00",
    ],
    [
      "2026-09-23T00:00:00-07:00",
      "2026-09-22T10:00:00-07:00",
      "2026-09-23T10:00:00-07:00",
    ],
  ])(
    "sends fourteen-hour reminders on the due day for %s",
    async (dueDate, early, expected) => {
      const task = await seedReminder({ dueDate });
      vi.setSystemTime(new Date(early));
      await checkAllReminders();
      expectNoDelivery();
      expect(await db.select().from(taskReminderSentTable)).toHaveLength(0);

      vi.setSystemTime(new Date(expected));
      await checkAllReminders();
      expect(createNotification).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          type: "due_date_reminder",
          resourceId: task.id,
          eventData: expect.objectContaining({
            dueDate: task.dueDate?.toISOString(),
            leadTimeMinutes: 840,
          }),
        }),
      );
      expect(sendDueDateReminder).toHaveBeenCalledExactlyOnceWith(
        expect.any(Object),
        task.id,
        task.projectId,
        840,
        task.dueDate,
      );

      vi.setSystemTime(new Date(new Date(expected).getTime() + 5 * 60 * 1000));
      await checkAllReminders();
      expect(createNotification).toHaveBeenCalledTimes(1);
      expect(sendDueDateReminder).toHaveBeenCalledTimes(1);
    },
  );

  it("does not mark a task overdue until the due day ends", async () => {
    const task = await seedReminder();
    for (const now of ["2026-09-23T00:00:00Z", "2026-09-23T23:59:59.999Z"]) {
      vi.setSystemTime(new Date(now));
      await checkDueDateReminders();
      expectNoDelivery();
    }
    vi.setSystemTime(new Date("2026-09-24T00:00:00Z"));
    await checkDueDateReminders();
    expect(createNotification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        type: "task_overdue",
        resourceId: task.id,
      }),
    );
  });

  it("uses expiration for the default one-day lead time without preferences", async () => {
    await seedReminder({ leadTimeMinutes: null });
    vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
    await checkAllReminders();
    expectNoDelivery();
    vi.setSystemTime(new Date("2026-09-23T00:00:00Z"));
    await checkAllReminders();
    expect(createNotification).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "due_date_reminder" }),
    );
    expect(sendDueDateReminder).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["2026-09-23T09:59:59.999Z", 0],
    ["2026-09-23T10:10:00.000Z", 1],
    ["2026-09-23T10:10:00.001Z", 0],
  ])("respects the delivery window at %s", async (now, count) => {
    await seedReminder();
    vi.setSystemTime(new Date(now));
    await checkAllReminders();
    expect(createNotification).toHaveBeenCalledTimes(count);
    expect(sendDueDateReminder).toHaveBeenCalledTimes(count);
  });

  it.each([{ completed: true }, { enabled: false }])(
    "skips reminders when %j",
    async (options) => {
      await seedReminder(options);
      for (const now of ["2026-09-23T10:00:00Z", "2026-09-24T00:00:00Z"]) {
        vi.setSystemTime(new Date(now));
        await checkAllReminders();
      }
      expectNoDelivery();
    },
  );
});
