import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { taskTable, userTable } from "../database/schema";
import { publishEvent, subscribeToEvent } from "../events";
import { activitySchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createActivity from "./controllers/create-activity";
import createComment from "./controllers/create-comment";
import deleteComment from "./controllers/delete-comment";
import getActivities from "./controllers/get-activities";
import updateComment from "./controllers/update-comment";

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatActivityDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const activity = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/:taskId",
    describeRoute({
      operationId: "getActivities",
      tags: ["Activity"],
      description: "Get all activities for a specific task",
      responses: {
        200: {
          description: "List of activities for the task",
          content: {
            "application/json": { schema: resolver(v.array(activitySchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const activities = await getActivities(taskId);
      return c.json(activities);
    },
  )
  .post(
    "/create",
    describeRoute({
      operationId: "createActivity",
      tags: ["Activity"],
      description: "Create a new activity (system-generated event)",
      responses: {
        200: {
          description: "Activity created successfully",
          content: {
            "application/json": { schema: resolver(activitySchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        taskId: v.string(),
        userId: v.string(),
        message: v.string(),
        type: v.string(),
      }),
    ),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId, userId, message, type } = c.req.valid("json");
      const activity = await createActivity(taskId, type, userId, message);
      return c.json(activity);
    },
  )
  .post(
    "/comment",
    describeRoute({
      operationId: "createComment",
      tags: ["Activity"],
      description: "Create a new comment on a task",
      responses: {
        200: {
          description: "Comment created successfully",
          content: {
            "application/json": { schema: resolver(activitySchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        taskId: v.string(),
        comment: v.string(),
      }),
    ),
    workspaceAccess.fromTaskId(),
    async (c) => {
      const { taskId, comment } = c.req.valid("json");
      const userId = c.get("userId");
      const newComment = await createComment(taskId, userId, comment);

      const [user] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, userId));

      const [task] = await db
        .select({ projectId: taskTable.projectId })
        .from(taskTable)
        .where(eq(taskTable.id, taskId));

      if (task) {
        await publishEvent("task.comment_created", {
          taskId,
          userId,
          comment: `"${user?.name}" commented: ${comment}`,
          projectId: task.projectId,
        });
      }

      return c.json(newComment);
    },
  )
  .put(
    "/comment",
    describeRoute({
      operationId: "updateComment",
      tags: ["Activity"],
      description: "Update an existing comment",
      responses: {
        200: {
          description: "Comment updated successfully",
          content: {
            "application/json": { schema: resolver(activitySchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        activityId: v.string(),
        comment: v.string(),
      }),
    ),
    workspaceAccess.fromActivity("activityId"),
    async (c) => {
      const { activityId, comment } = c.req.valid("json");
      const userId = c.get("userId");
      const updatedComment = await updateComment(userId, activityId, comment);
      return c.json(updatedComment);
    },
  )
  .delete(
    "/comment",
    describeRoute({
      operationId: "deleteComment",
      tags: ["Activity"],
      description: "Delete a comment",
      responses: {
        200: {
          description: "Comment deleted successfully",
          content: {
            "application/json": { schema: resolver(activitySchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        activityId: v.string(),
      }),
    ),
    workspaceAccess.fromActivity("activityId"),
    async (c) => {
      const { activityId } = c.req.valid("json");
      const userId = c.get("userId");
      const deletedComment = await deleteComment(userId, activityId);
      return c.json(deletedComment);
    },
  );

subscribeToEvent<{
  taskId: string;
  userId: string;
  type: string;
  content: string;
}>("task.created", async (data) => {
  if (!data.userId || !data.taskId || !data.type || !data.content) {
    return;
  }
  await createActivity(data.taskId, data.type, data.userId, data.content);
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  title: string;
  assigneeId?: string;
  type: string;
}>("task.status_changed", async (data) => {
  await createActivity(
    data.taskId,
    data.type,
    data.userId,
    `changed status from ${toDisplayCase(data.oldStatus)} to ${toDisplayCase(data.newStatus)}`,
  );
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldPriority: string;
  newPriority: string;
  title: string;
  type: string;
}>("task.priority_changed", async (data) => {
  await createActivity(
    data.taskId,
    data.type,
    data.userId,
    `changed priority from ${toDisplayCase(data.oldPriority)} to ${toDisplayCase(data.newPriority)}`,
  );
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  title: string;
  type: string;
}>("task.unassigned", async (data) => {
  await createActivity(
    data.taskId,
    data.type,
    data.userId,
    "unassigned the task",
  );
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldAssignee: string | null;
  newAssignee: string;
  newAssigneeId: string;
  title: string;
  type: string;
}>("task.assignee_changed", async (data) => {
  if (data.userId === data.newAssigneeId) {
    await createActivity(
      data.taskId,
      data.type,
      data.userId,
      "assigned the task to themselves",
    );
    return;
  }

  await createActivity(
    data.taskId,
    data.type,
    data.userId,
    `assigned the task to [[user:${data.newAssigneeId}|${data.newAssignee}]]`,
  );
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldDueDate: Date | null;
  newDueDate: Date;
  title: string;
  type: string;
}>("task.due_date_changed", async (data) => {
  const oldDate = formatActivityDate(data.oldDueDate) || "none";

  if (!data.newDueDate) {
    await createActivity(
      data.taskId,
      data.type,
      data.userId,
      "cleared the due date",
    );
    return;
  }

  const newDate = formatActivityDate(data.newDueDate);
  if (!newDate) return;

  await createActivity(
    data.taskId,
    data.type,
    data.userId,
    `changed due date from ${oldDate} to ${newDate}`,
  );
});

subscribeToEvent<{
  taskId: string;
  userId: string;
  oldTitle: string;
  newTitle: string;
  title: string;
  type: string;
}>("task.title_changed", async (data) => {
  await createActivity(
    data.taskId,
    data.type,
    data.userId,
    `changed title from "${data.oldTitle}" to "${data.newTitle}"`,
  );
});

export default activity;
