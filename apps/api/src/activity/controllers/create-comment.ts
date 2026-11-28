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
import { findInaccessibleProjectIds } from "../../project-access/find-inaccessible-project-ids";
import { parseMentionIds } from "../../utils/parse-mentions";

async function createComment(
  taskId: string,
  userId: string,
  content: string,
  options?: {
    external?: { userName: string; source: string };
    workspaceId?: string;
  },
) {
  const { external, workspaceId } = options ?? {};
  const { task, activity } = await db.transaction(async (tx) => {
    // Lock the project first, as project and task moves do. The comment and
    // its event must use the same scope even when a move is waiting.
    const [task] = await tx
      .select({
        assigneeId: taskTable.userId,
        projectId: taskTable.projectId,
        title: taskTable.title,
        workspaceId: projectTable.workspaceId,
      })
      .from(projectTable)
      .innerJoin(taskTable, eq(taskTable.projectId, projectTable.id))
      .where(eq(taskTable.id, taskId))
      .for("share", { of: [projectTable, taskTable] });
    if (!task || (workspaceId && task.workspaceId !== workspaceId)) {
      throw new HTTPException(404, { message: "Task not found" });
    }
    if (
      workspaceId &&
      (await findInaccessibleProjectIds(userId, [task.projectId], tx)).length
    ) {
      throw new HTTPException(403, {
        message: "You don't have access to this project",
      });
    }

    const [activity] = await tx
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
      throw new HTTPException(500, { message: "Failed to create activity" });
    }
    return { task, activity };
  });

  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));

  await publishEvent("comment.created", {
    ...activity,
    comment: `**${user?.name}** commented:\n> ${content}`,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
  });

  // Notify any workspace members @mentioned in the comment (not the author).
  const mentionedIds = parseMentionIds(content).filter((id) => id !== userId);
  for (const mentionedId of mentionedIds) {
    await createNotification({
      userId: mentionedId,
      type: "task_mention",
      eventData: {
        taskTitle: task.title,
        mentionerName: user?.name ?? null,
        projectId: task.projectId,
        workspaceId: task.workspaceId,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  if (
    task.assigneeId &&
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
