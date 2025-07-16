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
    userEmail: string;
  };
}>()
  .get("/", async (c) => {
    const userEmail = c.get("userEmail");
    const notifications = await getNotifications(userEmail);
    return c.json(notifications);
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        userEmail: z.string(),
        title: z.string(),
        content: z.string().optional(),
        type: z.string().optional(),
        resourceId: z.string().optional(),
        resourceType: z.string().optional(),
      }),
    ),
    async (c) => {
      const { userEmail, title, content, type, resourceId, resourceType } =
        c.req.valid("json");

      const notification = await createNotification({
        userEmail,
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
    const userEmail = c.get("userEmail");
    const result = await markAllNotificationsAsRead(userEmail);
    return c.json(result);
  })
  .delete("/clear-all", async (c) => {
    const userEmail = c.get("userEmail");
    const result = await clearNotifications(userEmail);
    return c.json(result);
  });

subscribeToEvent(
  "task.created",
  async ({
    taskId,
    userEmail,
    title,
  }: {
    taskId: string;
    userEmail: string;
    title?: string;
    type: string;
    content: string;
  }) => {
    if (!userEmail || !taskId) {
      return;
    }

    await createNotification({
      userEmail,
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
    ownerEmail,
    workspaceName,
  }: { workspaceId: string; ownerEmail: string; workspaceName: string }) => {
    if (!workspaceId || !ownerEmail) {
      return;
    }

    await createNotification({
      userEmail: ownerEmail,
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
    userEmail,
    oldStatus,
    newStatus,
    title,
  }: {
    taskId: string;
    userEmail: string | null;
    oldStatus: string;
    newStatus: string;
    title: string;
  }) => {
    if (!taskId || !userEmail) {
      return;
    }

    await createNotification({
      userEmail,
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
      userEmail: newAssignee,
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
    userEmail,
  }: {
    timeEntryId: string;
    taskId: string;
    userEmail: string;
    type: string;
    content: string;
  }) => {
    if (!timeEntryId || !taskId || !userEmail) {
      return;
    }

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (task) {
      await createNotification({
        userEmail,
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
