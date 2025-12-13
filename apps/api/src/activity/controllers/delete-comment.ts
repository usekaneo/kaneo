import { and, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function deleteComment(userId: string, id: string) {
  const [deletedComment] = await db
    .delete(activityTable)
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)))
    .returning();

  return deletedComment;
}

export default deleteComment;
