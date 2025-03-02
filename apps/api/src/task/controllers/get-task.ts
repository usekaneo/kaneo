import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function getTask(taskId: string) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return task;
}

export default getTask;
