import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function updateComment(userId: string, id: string, content: string) {
  const activity = await db.query.activityTable.findFirst({
    where: and(eq(activityTable.id, id), eq(activityTable.userId, userId)),
  });

  if (!activity) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  await assertTaskWritable(activity.taskId);

  const [updatedActivity] = await db
    .update(activityTable)
    .set({ content })
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  return updatedActivity;
}

export default updateComment;
