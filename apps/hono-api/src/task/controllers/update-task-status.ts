import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTaskStatus({
  id,
  status,
  userEmail,
}: { id: string; status: string; userEmail: string }) {
  await db
    .update(taskTable)
    .set({ status, userEmail })
    .where(eq(taskTable.id, id));
}

export default updateTaskStatus;
