import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable, userTable } from "../../database/schema";
import { publishEvent } from "../../events";
import createNotification from "../../notification/controllers/create-notification";
import { parseMentionIds } from "../../utils/parse-mentions";

async function createComment(taskId: string, userId: string, content: string) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
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
    .select({ projectId: taskTable.projectId, title: taskTable.title })
    .from(taskTable)
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
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  return activity;
}

export default createComment;
