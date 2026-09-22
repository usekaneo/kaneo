import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createComment from "../../apps/api/src/activity/controllers/create-comment";
import db, { schema } from "../../apps/api/src/database";
import { taskReminderSentTable } from "../../apps/api/src/database/schema";
import createNotification from "../../apps/api/src/notification/controllers/create-notification";
import getNotifications from "../../apps/api/src/notification/controllers/get-notifications";
import markAsRead from "../../apps/api/src/notification/controllers/mark-notification-as-read";

const { deliverNotification } = await vi.importActual<
  typeof import("../../apps/api/src/notification-preferences/delivery")
>("../../apps/api/src/notification-preferences/delivery");

import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import createTask from "../../apps/api/src/task/controllers/create-task";
import importTasks from "../../apps/api/src/task/controllers/import-tasks";
import updateAssignee from "../../apps/api/src/task/controllers/update-task-assignee";
import updateDescription from "../../apps/api/src/task/controllers/update-task-description";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { publish, sendEmail } = vi.hoisted(() => ({
  publish: vi.fn(),
  sendEmail: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));
vi.mock("@kaneo/email", async (original) => ({
  ...(await original<object>()),
  sendNotificationEmail: sendEmail,
}));

vi.mock("../../apps/api/src/notification-preferences/delivery", () => ({
  deliverNotification: vi.fn(async () => undefined),
}));

async function fixture() {
  const actor = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const member = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: actor.workspace.id,
    userId: member.user.id,
    joinedAt: new Date(),
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: actor.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Private task",
      userId: member.user.id,
    })
    .returning();
  return { actor, outsider, member, project, task };
}

describe("notification recipient boundaries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  it("filters outsider and nonexistent comment mentions without failing the comment", async () => {
    const { actor, outsider, member, task } = await fixture();
    const content = [member.user.id, outsider.user.id, "nonexistent"]
      .map((id) => `<kaneo-mention id="${id}">name</kaneo-mention>`)
      .join(" ");
    await expect(
      createComment(task.id, actor.user.id, content),
    ).resolves.toHaveProperty("content", content);
    const notifications = await db.select().from(schema.notificationTable);
    expect(notifications.map((n) => n.userId)).toEqual([member.user.id]);
    expect(notifications[0].type).toBe("task_mention");
  });

  it("filters description mentions at the shared creation boundary", async () => {
    const { actor, outsider, member, task } = await fixture();
    const description = [member.user.id, outsider.user.id, "nonexistent"]
      .map((id) => `<kaneo-mention id="${id}">name</kaneo-mention>`)
      .join(" ");
    await expect(
      updateDescription({
        id: task.id,
        currentUserId: actor.user.id,
        description,
      }),
    ).resolves.toHaveProperty("description", description);
    expect(
      (await db.select().from(schema.notificationTable)).map((n) => n.userId),
    ).toEqual([member.user.id]);
  });

  it("does not notify a stale assignee about comments or due dates", async () => {
    const { actor, member, task } = await fixture();
    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, member.user.id),
          eq(schema.workspaceUserTable.workspaceId, actor.workspace.id),
        ),
      );
    await db
      .update(schema.taskTable)
      .set({ dueDate: new Date(Date.now() - 60_000) })
      .where(eq(schema.taskTable.id, task.id));
    await createComment(task.id, actor.user.id, "Private comment");
    await checkDueDateReminders();
    expect(await db.select().from(schema.notificationTable)).toEqual([]);
    expect(await db.select().from(taskReminderSentTable)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps reminders working for current assignees", async () => {
    const { member, task } = await fixture();
    await db
      .update(schema.taskTable)
      .set({ dueDate: new Date(Date.now() - 60_000) })
      .where(eq(schema.taskTable.id, task.id));
    await checkDueDateReminders();
    expect(await getNotifications(member.user.id)).toEqual([
      expect.objectContaining({ type: "task_overdue", resourceId: task.id }),
    ]);
  });

  it("treats foreign, missing and unsupported references identically and never enriches historical forged references", async () => {
    const { outsider, member, task } = await fixture();
    for (const id of [task.id, "missing"]) {
      expect(
        await createNotification({
          userId: outsider.user.id,
          resourceType: "task",
          resourceId: id,
        }),
      ).toBeNull();
      await db.insert(schema.notificationTable).values({
        userId: outsider.user.id,
        resourceType: "task",
        resourceId: id,
        eventData: { taskTitle: "old leaked title" },
      });
    }
    expect(
      await createNotification({
        userId: member.user.id,
        resourceType: "unsupported",
        resourceId: task.id,
      }),
    ).toBeNull();
    expect(await getNotifications(outsider.user.id)).toEqual([]);
    expect(publish).not.toHaveBeenCalled();
    expect(
      await createNotification({
        userId: member.user.id,
        title: "Generic message",
      }),
    ).toHaveProperty("title", "Generic message");
  });

  it("hides historical contents from list, read response and external delivery after removal", async () => {
    const { actor, member, task } = await fixture();
    const notification = await createNotification({
      userId: member.user.id,
      resourceType: "task",
      resourceId: task.id,
      type: "task_comment",
      eventData: { taskTitle: task.title },
    });
    if (!notification) throw new Error("Expected member notification");
    expect(await getNotifications(member.user.id)).toEqual([
      expect.objectContaining({
        id: notification.id,
        eventData: expect.objectContaining({ workspaceId: actor.workspace.id }),
      }),
    ]);
    await db
      .insert(schema.userNotificationPreferenceTable)
      .values({ userId: member.user.id, emailEnabled: true });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: member.user.id,
      workspaceId: actor.workspace.id,
      isActive: true,
      emailEnabled: true,
    });
    await deliverNotification(notification.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, member.user.id),
          eq(schema.workspaceUserTable.workspaceId, actor.workspace.id),
        ),
      );
    expect(await getNotifications(member.user.id)).toEqual([]);
    await expect(
      markAsRead(notification.id, member.user.id),
    ).rejects.toMatchObject({ status: 404 });
    await deliverNotification(notification.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects foreign assignees while preserving valid partial imports", async () => {
    const { actor, outsider, member, project, task } = await fixture();
    await expect(
      updateAssignee({
        id: task.id,
        userId: outsider.user.id,
        currentUserId: actor.user.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createTask({
        projectId: project.id,
        title: "Invalid",
        status: "to-do",
        userId: outsider.user.id,
        currentUserId: actor.user.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      bulkUpdateTasks({
        taskIds: [task.id],
        operation: "updateAssignee",
        value: outsider.user.id,
        userId: actor.user.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 1 })
      .where(eq(schema.projectTable.id, project.id));
    await expect(
      importTasks(
        project.id,
        [
          { title: "Valid", status: "to-do" },
          { title: "Invalid", status: "to-do", userId: outsider.user.id },
        ],
        actor.user.id,
      ),
    ).resolves.toMatchObject({
      results: {
        successful: 1,
        failed: 1,
        tasks: [
          { success: true },
          {
            success: false,
            error: "Assignee is not a member of this workspace",
          },
        ],
      },
    });
    const tasks = await db.select().from(schema.taskTable);
    expect(tasks).toHaveLength(2);
    expect(tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: task.id, userId: member.user.id }),
        expect.objectContaining({ title: "Valid", userId: null }),
      ]),
    );
    expect(tasks.some((row) => row.userId === outsider.user.id)).toBe(false);
    await expect(
      updateAssignee({
        id: task.id,
        userId: actor.user.id,
        currentUserId: actor.user.id,
      }),
    ).resolves.toHaveProperty("userId", actor.user.id);
    await expect(
      updateAssignee({
        id: task.id,
        userId: null,
        currentUserId: actor.user.id,
      }),
    ).resolves.toHaveProperty("userId", null);
  });

  it("uses bounded non-redirecting requests and safe errors for all external channels", async () => {
    const { actor, member, task } = await fixture();
    const [notification] = await db
      .insert(schema.notificationTable)
      .values({
        userId: member.user.id,
        resourceType: "task",
        resourceId: task.id,
        type: "task_comment",
      })
      .returning();
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: member.user.id,
      ntfyEnabled: true,
      ntfyServerUrl: "http://127.0.0.1",
      ntfyTopic: "topic",
      ntfyToken: "ntfy-secret",
      gotifyEnabled: true,
      gotifyServerUrl: "http://127.0.0.1",
      gotifyToken: "gotify-secret",
      webhookEnabled: true,
      webhookUrl: "http://127.0.0.1/private-url?key=secret",
      webhookSecret: "webhook-secret",
    });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: member.user.id,
      workspaceId: actor.workspace.id,
      ntfyEnabled: true,
      gotifyEnabled: true,
      webhookEnabled: true,
    });
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    const fetchMock = vi
      .fn()
      .mockRejectedValue(
        new Error("gotify-secret ntfy-secret webhook-secret private-url"),
      );
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await deliverNotification(notification.id);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.redirect).toBe("error");
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    expect(log).toHaveBeenCalledTimes(3);
    const logged = JSON.stringify(log.mock.calls);
    for (const secret of [
      "gotify-secret",
      "ntfy-secret",
      "webhook-secret",
      "private-url",
    ])
      expect(logged).not.toContain(secret);
    expect(logged).toContain("network");
  });
});
