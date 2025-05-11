import { eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function updateComment(id: string, content: string) {
  return await db
    .update(activityTable)
    .set({ content })
    .where(eq(activityTable.id, id));
}

export default updateComment;
