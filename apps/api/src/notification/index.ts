import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import db from "../database";
import { taskTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import clearNotifications from "./controllers/clear-notifications";
import createNotification from "./controllers/create-notification";
import getNotifications from "./controllers/get-notifications";
import markAllNotificationsAsRead from "./controllers/mark-all-notifications-as-read";
import markNotificationAsRead from "./controllers/mark-notification-as-read";

const notification = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const notifications = await getNotifications(userId);
    return c.json(notifications);
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        userId: z.string(),
        title: z.string(),
        content: z.string().optional(),
        type: z.string().optional(),
        resourceId: z.string().optional(),
        resourceType: z.string().optional(),
      }),
    ),
    async (c) => {
      const { userId, title, content, type, resourceId, resourceType } =
        c.req.valid("json");

      const notification = await createNotification({
        userId,
        title,
        content,
        type,
        resourceId,
        resourceType,
      });

      return c.json(notification);
    },
  )
  .patch(
    "/:id/read",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const notification = await markNotificationAsRead(id);
      return c.json(notification);
    },
  )
  .patch("/read-all", async (c) => {
    const userId = c.get("userId");
    const result = await markAllNotificationsAsRead(userId);
    return c.json(result);
  })
  .delete("/clear-all", async (c) => {
    const userId = c.get("userId");
    const result = await clearNotifications(userId);
    return c.json(result);
  });

subscribeToEvent(
  "task.created",
  async ({
    taskId,
    userId,
    title,
  }: {
    taskId: string;
    userId: string;
    title?: string;
    type: string;
    content: string;
  }) => {
    if (!userId || !taskId) {
      return;
    }

    await createNotification({
      userId,
      title: "New Task Created",
      content: title ? `Task "${title}" was created` : "A new task was created",
      type: "task",
      resourceId: taskId,
      resourceType: "task",
    });
  },
);

subscribeToEvent(
  "workspace.created",
  async ({
    workspaceId,
    ownerId,
    workspaceName,
  }: {
    workspaceId: string;
    ownerId: string;
    workspaceName: string;
  }) => {
    if (!workspaceId || !ownerId) {
      return;
    }

    await createNotification({
      userId: ownerId,
      title: `Workspace "${workspaceName}" created`,
      type: "workspace",
      resourceId: workspaceId,
      resourceType: "workspace",
    });
  },
);

subscribeToEvent(
  "task.status_changed",
  async ({
    taskId,
    userId,
    oldStatus,
    newStatus,
    title,
  }: {
    taskId: string;
    userId: string | null;
    oldStatus: string;
    newStatus: string;
    title: string;
  }) => {
    if (!taskId || !userId) {
      return;
    }

    await createNotification({
      userId,
      title: `Task "${title}" moved from ${oldStatus.replace(/-/g, " ")} to ${newStatus.replace(/-/g, " ")}`,
      type: "task",
      resourceId: taskId,
      resourceType: "task",
    });
  },
);

subscribeToEvent(
  "task.assignee_changed",
  async ({
    taskId,
    newAssignee,
    title,
  }: {
    taskId: string;
    newAssignee: string | null;
    title: string;
  }) => {
    if (!taskId || !newAssignee) {
      return;
    }

    await createNotification({
      userId: newAssignee,
      title: "Task Assigned to You",
      content: `You have been assigned to task "${title}"`,
      type: "task",
      resourceId: taskId,
      resourceType: "task",
    });
  },
);

subscribeToEvent(
  "time-entry.created",
  async ({
    timeEntryId,
    taskId,
    userId,
  }: {
    timeEntryId: string;
    taskId: string;
    userId: string;
    type: string;
    content: string;
  }) => {
    if (!timeEntryId || !taskId || !userId) {
      return;
    }

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (task) {
      await createNotification({
        userId,
        title: "Time Tracking Started",
        content: `You started tracking time for task "${task.title}"`,
        type: "time-entry",
        resourceId: taskId,
        resourceType: "task",
      });
    }
  },
);

export default notification;
