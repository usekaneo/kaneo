import { beforeEach, expect, it, vi } from "vite-plus/test";
const m = vi.hoisted(() => ({ fail: true }));
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  async (original) => {
    const actual =
      await original<
        typeof import("../../apps/api/src/notification/controllers/create-notification")
      >();
    return {
      ...actual,
      persistNotification: async (
        ...args: Parameters<typeof actual.persistNotification>
      ) => {
        const notification = await actual.persistNotification(...args);
        if (m.fail)
          throw new Error("temporary notification failure after insert");
        return notification;
      },
    };
  },
);
import { sql } from "drizzle-orm";
import db, { schema } from "../../apps/api/src/database";
import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import { DUE_DATE_DURATION_MS } from "../../apps/api/src/scheduler/reminder-timing";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
async function createReminderTask() {
  const { workspace, user } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  await db.insert(schema.taskTable).values({
    projectId: project.id,
    userId: user.id,
    title: "test reminder",
    status: "to-do",
    columnId: columns.todo.id,
    number: 1,
    dueDate: new Date(Date.now() + (1440 - 5) * 60000 - DUE_DATE_DURATION_MS),
  });
}

it("rolls back both writes after a successful notification insert, then retries once", async () => {
  await createReminderTask();
  m.fail = true;
  expect(await checkDueDateReminders()).toEqual({ degraded: true });
  expect(await db.select().from(schema.taskReminderSentTable)).toHaveLength(0);
  expect(await db.select().from(schema.notificationTable)).toHaveLength(0);
  m.fail = false;
  expect(await checkDueDateReminders()).toEqual({ degraded: false });
  await checkDueDateReminders();
  expect(await db.select().from(schema.taskReminderSentTable)).toHaveLength(1);
  expect(await db.select().from(schema.notificationTable)).toHaveLength(1);
});

it("releases the reminder claim after PostgreSQL rejects the notification insert", async () => {
  await createReminderTask();
  m.fail = false;
  await db.execute(sql`CREATE FUNCTION reject_reminder_notification() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'test notification insert failure'; END;
  $$ LANGUAGE plpgsql`);
  await db.execute(sql`CREATE TRIGGER reject_reminder_notification BEFORE INSERT ON notification
    FOR EACH ROW EXECUTE FUNCTION reject_reminder_notification()`);
  try {
    expect(await checkDueDateReminders()).toEqual({ degraded: true });
    expect(await db.select().from(schema.taskReminderSentTable)).toHaveLength(
      0,
    );
    expect(await db.select().from(schema.notificationTable)).toHaveLength(0);
  } finally {
    await db.execute(
      sql`DROP TRIGGER reject_reminder_notification ON notification`,
    );
    await db.execute(sql`DROP FUNCTION reject_reminder_notification()`);
  }
  expect(await checkDueDateReminders()).toEqual({ degraded: false });
  await checkDueDateReminders();
  expect(await db.select().from(schema.taskReminderSentTable)).toHaveLength(1);
  expect(await db.select().from(schema.notificationTable)).toHaveLength(1);
});
