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
      persistNotification: (
        ...args: Parameters<typeof actual.persistNotification>
      ) => {
        if (m.fail) throw new Error("temporary notification failure");
        return actual.persistNotification(...args);
      },
    };
  },
);
import db, { schema } from "../../apps/api/src/database";
import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import { DUE_DATE_DURATION_MS } from "../../apps/api/src/scheduler/reminder-timing";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
it("rolls back the reminder claim when notification creation fails, then retries once", async () => {
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
