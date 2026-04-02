import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
} from "../database/schema";
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

type TaskNotificationContext = {
  assigneeId: string | null;
  projectIcon: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  taskId: string;
  taskTitle: string;
  workspaceId: string;
};

async function getTaskNotificationContext(
  taskId: string,
): Promise<TaskNotificationContext | null> {
  const [context] = await db
    .select({
      assigneeId: taskTable.userId,
      projectIcon: projectTable.icon,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      taskId: taskTable.id,
      taskTitle: taskTable.title,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  return context ?? null;
}

async function getPriorCommenterIds(taskId: string, actorUserId: string) {
  const commenters = await db
    .select({ userId: activityTable.userId })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.taskId, taskId),
        eq(activityTable.type, "comment"),
        ne(activityTable.userId, actorUserId),
      ),
    );

  return [
    ...new Set(
      commenters
        .map((commenter) => commenter.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
}

function buildTaskEventData(
  context: TaskNotificationContext,
  extras?: Record<string, unknown>,
) {
  return {
    projectIcon: context.projectIcon,
    projectId: context.projectId,
    projectName: context.projectName,
    projectSlug: context.projectSlug,
    taskId: context.taskId,
    taskTitle: context.taskTitle,
    workspaceId: context.workspaceId,
    ...extras,
  };
}

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
        title: v.optional(v.nullable(v.string())),
        message: v.optional(v.nullable(v.string())),
        type: v.string(),
        eventData: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
        relatedEntityId: v.optional(v.string()),
        relatedEntityType: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const {
        title,
        message,
        type,
        eventData,
        relatedEntityId,
        relatedEntityType,
      } = c.req.valid("json");
      const userId = c.get("userId");
      const notification = await createNotification({
        userId,
        title,
        content: message,
        type,
        eventData,
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
      const userId = c.get("userId");
      const notification = await markAsRead(id, userId);
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
}>("task.created", async (data) => {
  if (!data.userId) {
    return;
  }

  const context = await getTaskNotificationContext(data.taskId);

  if (!context) {
    return;
  }

  await createNotification({
    userId: data.userId,
    type: "task_created",
    eventData: buildTaskEventData(context),
    resourceId: data.taskId,
    resourceType: "task",
  });
});

subscribeToEvent<{
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerId?: string;
}>("workspace.created", async (data) => {
  if (!data.ownerId) {
    return;
  }

  await createNotification({
    userId: data.ownerId,
    type: "workspace_created",
    eventData: {
      workspaceId: data.workspaceId,
      workspaceName: data.workspaceName,
    },
    resourceId: data.workspaceId,
    resourceType: "workspace",
  });
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  title: string;
  assigneeId?: string;
}>("task.status_changed", async (data) => {
  if (!data.assigneeId || data.assigneeId === data.userId) {
    return;
  }

  const context = await getTaskNotificationContext(data.taskId);

  if (!context) {
    return;
  }

  await createNotification({
    userId: data.assigneeId,
    type: "task_status_changed",
    eventData: buildTaskEventData(context, {
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
    }),
    resourceId: data.taskId,
    resourceType: "task",
  });
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldAssignee: string | null;
  newAssignee: string;
  newAssigneeId: string;
  title: string;
}>("task.assignee_changed", async (data) => {
  if (!data.newAssigneeId) {
    return;
  }

  const context = await getTaskNotificationContext(data.taskId);

  if (!context) {
    return;
  }

  await createNotification({
    userId: data.newAssigneeId,
    type: "task_assignee_changed",
    eventData: buildTaskEventData(context),
    resourceId: data.taskId,
    resourceType: "task",
  });
});

subscribeToEvent<{
  comment?: string;
  commentId?: string;
  projectId?: string;
  taskId: string;
  userId: string;
}>("task.comment_created", async (data) => {
  const context = await getTaskNotificationContext(data.taskId);

  if (!context) {
    return;
  }

  const [actor] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
    })
    .from(userTable)
    .where(eq(userTable.id, data.userId))
    .limit(1);

  const recipientIds = new Set<string>();

  if (context.assigneeId && context.assigneeId !== data.userId) {
    recipientIds.add(context.assigneeId);
  }

  const priorCommenterIds = await getPriorCommenterIds(
    data.taskId,
    data.userId,
  );

  for (const commenterId of priorCommenterIds) {
    recipientIds.add(commenterId);
  }

  for (const recipientId of recipientIds) {
    await createNotification({
      userId: recipientId,
      type: "task_comment_created",
      eventData: buildTaskEventData(context, {
        actorName: actor?.name ?? "Someone",
        actorUserId: data.userId,
        commentId: data.commentId ?? null,
      }),
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
  if (!data.taskOwnerId || data.taskOwnerId === data.userId) {
    return;
  }

  const context = await getTaskNotificationContext(data.taskId);

  if (!context) {
    return;
  }

  await createNotification({
    userId: data.taskOwnerId,
    type: "time_entry_created",
    eventData: buildTaskEventData(context),
    resourceId: data.taskId,
    resourceType: "task",
  });
});

export default notification;
