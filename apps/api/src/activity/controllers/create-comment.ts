import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  dispatchNotification,
  persistNotification,
} from "../../notification/controllers/create-notification";
import { parseMentionIds } from "../../utils/parse-mentions";

type Database = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type Activity = typeof activityTable.$inferSelect;
export type RecordedComment = {
  activity: Activity;
  // Null when the task vanished; no event is published then.
  projectId: string | null;
  summary: string;
  notifications: Array<{ id: string; userId: string }>;
};

// Writes the comment and its notifications. Pair with publishCommentCreated
// after the surrounding transaction commits.
export async function recordComment(
  database: Database,
  taskId: string,
  userId: string,
  content: string,
  external?: { userName: string; source: string },
): Promise<RecordedComment> {
  const [activity] = await database
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
      ...(external
        ? {
            externalUserName: external.userName,
            externalSource: external.source,
          }
        : {}),
    })
    .returning();

  if (!activity) {
    throw new HTTPException(500, {
      message: "Failed to create activity",
    });
  }

  const [user] = await database
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));

  const [task] = await database
    .select({
      assigneeId: taskTable.userId,
      projectId: taskTable.projectId,
      title: taskTable.title,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId));

  const notifications: RecordedComment["notifications"] = [];
  const notify = async (data: Parameters<typeof persistNotification>[0]) => {
    const notification = await persistNotification(data, database);
    if (notification)
      notifications.push({
        id: notification.id,
        userId: notification.userId,
      });
  };

  // Notify any workspace members @mentioned in the comment (not the author).
  const mentionedIds = parseMentionIds(content).filter((id) => id !== userId);
  for (const mentionedId of mentionedIds) {
    await notify({
      userId: mentionedId,
      type: "task_mention",
      eventData: {
        taskTitle: task?.title ?? null,
        mentionerName: user?.name ?? null,
        projectId: task?.projectId ?? null,
        workspaceId: task?.workspaceId ?? null,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  if (
    task?.assigneeId &&
    task.assigneeId !== userId &&
    !mentionedIds.includes(task.assigneeId)
  ) {
    await notify({
      userId: task.assigneeId,
      type: "task_comment",
      eventData: {
        taskTitle: task.title,
        commenterName: user?.name ?? null,
        commentPreview: content.slice(0, 160),
        projectId: task.projectId,
        workspaceId: task.workspaceId,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  return {
    activity,
    projectId: task?.projectId ?? null,
    summary: `**${user?.name}** commented:\n> ${content}`,
    notifications,
  };
}

export async function publishCommentCreated(recorded: RecordedComment) {
  if (recorded.projectId) {
    await publishEvent("comment.created", {
      ...recorded.activity,
      comment: recorded.summary,
      projectId: recorded.projectId,
    });
  }
  for (const notification of recorded.notifications)
    await dispatchNotification(notification);
}

async function createComment(
  taskId: string,
  userId: string,
  content: string,
  external?: { userName: string; source: string },
) {
  const recorded = await recordComment(db, taskId, userId, content, external);
  await publishCommentCreated(recorded);
  return recorded.activity;
}

export default createComment;
