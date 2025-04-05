import { count, eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function getNextTaskNumber(projectId: string) {
  const [task] = await db
    .select({ count: count() })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  return task ? task.count : 0;
}

export default getNextTaskNumber;
