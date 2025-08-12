import { and, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function deleteComment(userId: string, id: string) {
  await db
    .delete(activityTable)
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)));
}

export default deleteComment;
