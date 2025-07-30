import { eq } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskLabelTable } from "../../database/schema";

async function getLabelsByTaskId(taskId: string) {
  const labels = await db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
      workspaceId: labelTable.workspaceId,
      createdAt: labelTable.createdAt,
    })
    .from(taskLabelTable)
    .innerJoin(labelTable, eq(taskLabelTable.labelId, labelTable.id))
    .where(eq(taskLabelTable.taskId, taskId))
    .orderBy(labelTable.name);

  return labels;
}

export default getLabelsByTaskId;
