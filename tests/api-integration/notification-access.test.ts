import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import createComment from "../../apps/api/src/activity/controllers/create-comment";
import db, { schema } from "../../apps/api/src/database";
import { taskReminderSentTable } from "../../apps/api/src/database/schema";
import clearNotifications from "../../apps/api/src/notification/controllers/clear-notifications";
import createNotification, {
  persistNotification,
} from "../../apps/api/src/notification/controllers/create-notification";
import deleteNotification from "../../apps/api/src/notification/controllers/delete-notification";
import getNotifications from "../../apps/api/src/notification/controllers/get-notifications";
import setNotificationRead from "../../apps/api/src/notification/controllers/set-notification-read";

vi.mock("../../apps/api/src/import/destination-fetch", () => ({
  destinationFetch: (input: string, init?: RequestInit) => fetch(input, init),
}));

const { deliverNotification } = await vi.importActual<
  typeof import("../../apps/api/src/notification-preferences/delivery")
>("../../apps/api/src/notification-preferences/delivery");

import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import { DUE_DATE_DURATION_MS } from "../../apps/api/src/scheduler/reminder-timing";
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
      .set({ dueDate: new Date(Date.now() - DUE_DATE_DURATION_MS - 60_000) })
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
      .set({ dueDate: new Date(Date.now() - DUE_DATE_DURATION_MS - 60_000) })
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
      setNotificationRead(notification.id, member.user.id, true),
    ).rejects.toMatchObject({
      status: 404,
    });
    await deliverNotification(notification.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("changes, deletes and clears only the caller's own notifications", async () => {
    const { actor, member, task } = await fixture();
    const insert = (userId: string, isRead: boolean) =>
      db
        .insert(schema.notificationTable)
        .values({
          userId,
          isRead,
          resourceType: "task",
          resourceId: task.id,
          type: "task_comment",
        })
        .returning()
        .then(([row]) => row);
    const read = await insert(member.user.id, true);
    const unread = await insert(member.user.id, false);
    const foreign = await insert(actor.user.id, true);

    await expect(
      setNotificationRead(read.id, member.user.id, false),
    ).resolves.toHaveProperty("isRead", false);
    await expect(
      setNotificationRead(foreign.id, member.user.id, false),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      deleteNotification(foreign.id, member.user.id),
    ).rejects.toMatchObject({ status: 404 });

    await setNotificationRead(read.id, member.user.id, true);
    await clearNotifications(member.user.id, actor.workspace.id, true);
    const remaining = await db.select().from(schema.notificationTable);
    expect(remaining.map((row) => row.id).sort()).toEqual(
      [unread.id, foreign.id].sort(),
    );

    await expect(
      deleteNotification(unread.id, member.user.id),
    ).resolves.toEqual({ success: true });
    expect(
      (await db.select().from(schema.notificationTable)).map((row) => row.id),
    ).toEqual([foreign.id]);
  });

  it.each(["task", "workspace"])(
    "rechecks current %s read permission before creation and personal email/webhook delivery",
    async (resourceType) => {
      const { actor, member, task } = await fixture();
      const [role] = await db
        .insert(schema.workspaceRoleTable)
        .values({
          workspaceId: actor.workspace.id,
          role: "limited",
          permission: JSON.stringify({ task: ["read"], workspace: ["read"] }),
        })
        .returning();
      await db
        .update(schema.workspaceUserTable)
        .set({ role: "limited" })
        .where(
          and(
            eq(schema.workspaceUserTable.userId, member.user.id),
            eq(schema.workspaceUserTable.workspaceId, actor.workspace.id),
          ),
        );
      await db.insert(schema.userNotificationPreferenceTable).values({
        userId: member.user.id,
        emailEnabled: true,
        webhookEnabled: true,
        webhookUrl: "http://127.0.0.1/notifications",
      });
      await db.insert(schema.userNotificationWorkspaceRuleTable).values({
        userId: member.user.id,
        workspaceId: actor.workspace.id,
        isActive: true,
        emailEnabled: true,
        webhookEnabled: true,
      });
      vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
      const fetchMock = vi.fn().mockResolvedValue(new Response(null));
      vi.stubGlobal("fetch", fetchMock);
      const input = {
        userId: member.user.id,
        resourceType,
        resourceId: resourceType === "task" ? task.id : actor.workspace.id,
        type: resourceType === "task" ? "task_comment" : "workspace_created",
        eventData: {
          taskTitle: "Private title",
          workspaceName: "Private workspace",
        },
      };
      const notification = await createNotification(input);
      if (!notification) throw new Error("Expected readable notification");
      await deliverNotification(notification.id);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await db
        .update(schema.workspaceRoleTable)
        .set({ permission: "{}" })
        .where(eq(schema.workspaceRoleTable.id, role.id));
      await deliverNotification(notification.id);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await createNotification(input)).toBeNull();
      expect(
        await createNotification({ userId: member.user.id, title: "Personal" }),
      ).toHaveProperty("title", "Personal");
    },
  );

  it("uses injected transaction grants for creation, including uncommitted role revocation", async () => {
    const { actor, member, task } = await fixture();
    const [role] = await db
      .insert(schema.workspaceRoleTable)
      .values({
        workspaceId: actor.workspace.id,
        role: "limited",
        permission: JSON.stringify({ task: ["read"] }),
      })
      .returning();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "limited" })
      .where(
        and(
          eq(schema.workspaceUserTable.userId, member.user.id),
          eq(schema.workspaceUserTable.workspaceId, actor.workspace.id),
        ),
      );
    await db.transaction(async (tx) => {
      const input = {
        userId: member.user.id,
        resourceType: "task",
        resourceId: task.id,
      };
      expect(await persistNotification(input, tx)).toHaveProperty(
        "resourceId",
        task.id,
      );
      await tx
        .update(schema.workspaceRoleTable)
        .set({ permission: "{}" })
        .where(eq(schema.workspaceRoleTable.id, role.id));
      expect(await persistNotification(input, tx)).toBeNull();
      expect(
        await persistNotification(
          { userId: member.user.id, title: "Personal" },
          tx,
        ),
      ).toHaveProperty("title", "Personal");
    });
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

  it("sends ntfy titles with non-Latin-1 characters as a valid header", async () => {
    const { actor, member, task } = await fixture();
    const [notification] = await db
      .insert(schema.notificationTable)
      .values({
        userId: member.user.id,
        resourceType: "task",
        resourceId: task.id,
        type: "task_comment",
        title: "日本語のタスク",
        content: "body",
      })
      .returning();
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: member.user.id,
      ntfyEnabled: true,
      ntfyServerUrl: "http://127.0.0.1",
      ntfyTopic: "topic",
    });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: member.user.id,
      workspaceId: actor.workspace.id,
      ntfyEnabled: true,
    });
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await deliverNotification(notification.id);
    expect(log).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const title = new Headers(fetchMock.mock.calls[0][1].headers).get("Title");
    const [, encoded] = title?.match(/^=\?UTF-8\?B\?(.+)\?=$/) ?? [];
    expect(Buffer.from(encoded ?? "", "base64").toString()).toBe(
      "日本語のタスク",
    );
  });
});
