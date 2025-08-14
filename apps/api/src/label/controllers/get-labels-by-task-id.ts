import { eq } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskLabelTable } from "../../database/schema";

async function getLabelsByTaskId(taskId: string) {
  const rows = await db
    .select({ label: labelTable })
    .from(labelTable)
    .innerJoin(taskLabelTable, eq(taskLabelTable.labelId, labelTable.id))
    .where(eq(taskLabelTable.taskId, taskId));

  return rows.map((row) => row.label);
}

export default getLabelsByTaskId;
