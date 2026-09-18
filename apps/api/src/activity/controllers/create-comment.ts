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
import createNotification from "../../notification/controllers/create-notification";
import { parseMentionIds } from "../../utils/parse-mentions";
import { assertReplyTarget } from "./comment-extras";

async function createComment(
  taskId: string,
  userId: string,
  content: string,
  external?: { userName: string; source: string },
  replyToId?: string,
) {
  const repliedTo = replyToId
    ? await assertReplyTarget(taskId, replyToId)
    : null;

  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
      replyToId: repliedTo?.id ?? null,
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

  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));

  const [task] = await db
    .select({
      assigneeId: taskTable.userId,
      projectId: taskTable.projectId,
      title: taskTable.title,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId));

  if (task) {
    await publishEvent("comment.created", {
      ...activity,
      comment: `**${user?.name}** commented:\n> ${content}`,
      projectId: task.projectId,
    });
  }

  // Notify any workspace members @mentioned in the comment (not the author).
  const mentionedIds = parseMentionIds(content).filter((id) => id !== userId);
  for (const mentionedId of mentionedIds) {
    await createNotification({
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

  // Whoever wrote the comment being replied to hears about the reply.
  const replyAuthor = repliedTo?.userId;
  if (
    task &&
    replyAuthor &&
    replyAuthor !== userId &&
    !mentionedIds.includes(replyAuthor)
  ) {
    await createNotification({
      userId: replyAuthor,
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

  if (
    task?.assigneeId &&
    task.assigneeId !== replyAuthor &&
    task.assigneeId !== userId &&
    !mentionedIds.includes(task.assigneeId)
  ) {
    await createNotification({
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

  return activity;
}

export default createComment;
