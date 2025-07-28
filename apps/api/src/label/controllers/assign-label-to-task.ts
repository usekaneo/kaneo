import { and, eq } from "drizzle-orm";
import db from "../../database";
import { taskLabelTable } from "../../database/schema";

async function assignLabelToTask(taskId: string, labelId: string) {
  const existingAssignment = await db
    .select()
    .from(taskLabelTable)
    .where(
      and(
        eq(taskLabelTable.taskId, taskId),
        eq(taskLabelTable.labelId, labelId),
      ),
    )
    .limit(1);

  if (existingAssignment.length > 0) {
    throw new Error("Label is already assigned to this task");
  }

  const [taskLabel] = await db
    .insert(taskLabelTable)
    .values({ taskId, labelId })
    .returning();

  return taskLabel;
}

export default assignLabelToTask;
