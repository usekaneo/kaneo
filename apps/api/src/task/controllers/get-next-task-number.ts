import { eq, max } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function getNextTaskNumber(projectId: string) {
  const [result] = await db
    .select({ maxNumber: max(taskTable.number) })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  return result?.maxNumber ?? 0;
}

export default getNextTaskNumber;
