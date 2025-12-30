import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function deleteTask(taskId: string) {
  await assertTaskWritable(taskId);

  const task = await db
    .delete(taskTable)
    .where(eq(taskTable.id, taskId))
    .returning()
    .execute();

  return task;
}

export default deleteTask;
