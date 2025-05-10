import { eq } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";

async function deleteComment(id: string) {
  await db.delete(activityTable).where(eq(activityTable.id, id));
}

export default deleteComment;
