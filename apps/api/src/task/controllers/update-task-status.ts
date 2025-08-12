import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTaskStatus({
  id,
  status,
  userId,
}: { id: string; status: string; userId: string }) {
  await db
    .update(taskTable)
    .set({ status, userId })
    .where(eq(taskTable.id, id));
}

export default updateTaskStatus;
