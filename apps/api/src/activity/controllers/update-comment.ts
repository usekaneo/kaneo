import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateComment(userId: string, id: string, content: string) {
  const [updated] = await db
    .update(activityTable)
    .set({ content })
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new HTTPException(404, {
      message: "Comment not found or you are not the author",
    });
  }

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, updated.taskId))
    .limit(1);

  if (task) {
    await publishEvent("comment.updated", {
      ...updated,
      projectId: task.projectId,
      userId,
    });
  }

  return updated;
}

export default updateComment;
