import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { commentTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function deleteComment(userId: string, id: string) {
  const [existing] = await db
    .select({ userId: commentTable.userId, taskId: commentTable.taskId })
    .from(commentTable)
    .where(eq(commentTable.id, id))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  if (existing.userId !== userId) {
    throw new HTTPException(403, {
      message: "Only the author can delete this comment",
    });
  }

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, existing.taskId))
    .limit(1);

  const [deleted] = await db
    .delete(commentTable)
    .where(eq(commentTable.id, id))
    .returning();

  if (!deleted) {
    throw new HTTPException(500, { message: "Failed to delete comment" });
  }

  if (task) {
    await publishEvent("comment.deleted", {
      ...deleted,
      projectId: task.projectId,
      userId,
    });
  }

  return deleted;
}

export default deleteComment;
