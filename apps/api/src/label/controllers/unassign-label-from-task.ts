import { and, eq } from "drizzle-orm";
import db from "../../database";
import { taskLabelTable } from "../../database/schema";

async function unassignLabelFromTask(taskId: string, labelId: string) {
  const deletedAssignment = await db
    .delete(taskLabelTable)
    .where(
      and(
        eq(taskLabelTable.taskId, taskId),
        eq(taskLabelTable.labelId, labelId),
      ),
    )
    .returning();

  if (deletedAssignment.length === 0) {
    throw new Error("Label assignment not found");
  }

  return deletedAssignment[0];
}

export default unassignLabelFromTask;
