import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function deleteComment(userId: string, id: string) {
  const activity = await db.query.activityTable.findFirst({
    where: and(eq(activityTable.id, id), eq(activityTable.userId, userId)),
  });

  if (!activity) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  await assertTaskWritable(activity.taskId);

  const [deletedComment] = await db
    .delete(activityTable)
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  return deletedComment;
}

export default deleteComment;
