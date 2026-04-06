import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { commentTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createComment(taskId: string, userId: string, content: string) {
  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [comment] = await db
    .insert(commentTable)
    .values({
      taskId,
      userId,
      content,
    })
    .returning();

  if (!comment) {
    throw new HTTPException(500, { message: "Failed to create comment" });
  }

  await publishEvent("comment.created", {
    ...comment,
    taskId: comment.taskId,
    projectId: task.projectId,
    userId,
  });

  return comment;
}

export default createComment;
