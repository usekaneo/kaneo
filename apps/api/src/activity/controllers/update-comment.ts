import { and, eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function updateComment(userId: string, id: string, content: string) {
  return await db
    .update(activityTable)
    .set({ content })
    .where(and(eq(activityTable.id, id), eq(activityTable.userId, userId)));
}

export default updateComment;
