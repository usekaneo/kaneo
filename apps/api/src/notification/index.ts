import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { subscribeToEvent } from "../events";
import { notificationSchema } from "../schemas";
import clearNotifications from "./controllers/clear-notifications";
import createNotification from "./controllers/create-notification";
import getNotifications from "./controllers/get-notifications";
import markAllNotificationsAsRead from "./controllers/mark-all-notifications-as-read";
import markAsRead from "./controllers/mark-notification-as-read";

const bulkResultSchema = v.object({
  success: v.boolean(),
  count: v.optional(v.number()),
});

const notification = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listNotifications",
      tags: ["Notifications"],
      description: "Get all notifications for the current user",
      responses: {
        200: {
          description: "List of notifications",
          content: {
            "application/json": {
              schema: resolver(v.array(notificationSchema)),
            },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const notifications = await getNotifications(userId);
      return c.json(notifications);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createNotification",
      tags: ["Notifications"],
      description: "Create a new notification for a user",
      responses: {
        200: {
          description: "Notification created successfully",
          content: {
            "application/json": { schema: resolver(notificationSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        userId: v.string(),
        title: v.string(),
        message: v.string(),
        type: v.string(),
        relatedEntityId: v.optional(v.string()),
        relatedEntityType: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const {
        userId,
        title,
        message,
        type,
        relatedEntityId,
        relatedEntityType,
      } = c.req.valid("json");
      const notification = await createNotification({
        userId,
        title,
        content: message,
        type,
        resourceId: relatedEntityId,
        resourceType: relatedEntityType,
      });
      return c.json(notification);
    },
  )
  .patch(
    "/:id/read",
    describeRoute({
      operationId: "markNotificationAsRead",
      tags: ["Notifications"],
      description: "Mark a specific notification as read",
      responses: {
        200: {
          description: "Notification marked as read",
          content: {
            "application/json": { schema: resolver(notificationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const notification = await markAsRead(id);
      return c.json(notification);
    },
  )
  .patch(
    "/read-all",
    describeRoute({
      operationId: "markAllNotificationsAsRead",
      tags: ["Notifications"],
      description: "Mark all notifications as read for the current user",
      responses: {
        200: {
          description: "All notifications marked as read",
          content: {
            "application/json": { schema: resolver(bulkResultSchema) },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const result = await markAllNotificationsAsRead(userId);
      return c.json(result);
    },
  )
  .delete(
    "/clear-all",
    describeRoute({
      operationId: "clearAllNotifications",
      tags: ["Notifications"],
      description: "Clear all notifications for the current user",
      responses: {
        200: {
          description: "All notifications cleared",
          content: {
            "application/json": { schema: resolver(bulkResultSchema) },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const result = await clearNotifications(userId);
      return c.json(result);
    },
  );

subscribeToEvent<{
  taskId: string;
  userId: string;
  title: string;
  projectId: string;
}>("task.created", async (data) => {
  if (data.userId) {
    await createNotification({
      userId: data.userId,
      title: "New task assigned",
      content: `You have been assigned to task: ${data.title}`,
      type: "task_created",
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

subscribeToEvent<{
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerId?: string;
}>("workspace.created", async (data) => {
  if (data.ownerId) {
    await createNotification({
      userId: data.ownerId,
      title: "Workspace created",
      content: `Your workspace "${data.workspaceName}" has been created successfully`,
      type: "workspace_created",
      resourceId: data.workspaceId,
      resourceType: "workspace",
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  title: string;
  assigneeId?: string;
}>("task.status_changed", async (data) => {
  if (data.assigneeId && data.assigneeId !== data.userId) {
    await createNotification({
      userId: data.assigneeId,
      title: "Task status changed",
      content: `Task "${data.title}" status changed from "${data.oldStatus}" to "${data.newStatus}"`,
      type: "task_status_changed",
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldAssignee: string | null;
  newAssignee: string;
  newAssigneeId: string;
  title: string;
}>("task.assignee_changed", async (data) => {
  if (data.newAssigneeId) {
    await createNotification({
      userId: data.newAssigneeId,
      title: "Task assigned to you",
      content: `You have been assigned to task: ${data.title}`,
      type: "task_assignee_changed",
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

subscribeToEvent<{
  timeEntryId: string;
  taskId: string;
  userId: string;
  taskOwnerId?: string;
  taskTitle?: string;
}>("time-entry.created", async (data) => {
  if (data.taskOwnerId && data.taskOwnerId !== data.userId) {
    await createNotification({
      userId: data.taskOwnerId,
      title: "Time tracking started",
      content: `Time tracking started on task${data.taskTitle ? `: ${data.taskTitle}` : ""}`,
      type: "time_entry_created",
      resourceId: data.taskId,
      resourceType: "task",
    });
  }
});

export default notification;
