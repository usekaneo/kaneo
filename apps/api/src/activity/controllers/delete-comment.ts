import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function deleteComment(userId: string, id: string) {
  const [deletedComment] = await db
    .delete(activityTable)
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  if (!deletedComment) {
    throw new HTTPException(404, {
      message: "Comment not found or you are not the author",
    });
  }

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, deletedComment.taskId))
    .limit(1);

  if (task) {
    await publishEvent("comment.deleted", {
      ...deletedComment,
      projectId: task.projectId,
      userId,
    });
  }

  return deletedComment;
}

export default deleteComment;
