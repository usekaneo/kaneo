import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function deleteTask(taskId: string) {
  const task = await db
    .delete(taskTable)
    .where(eq(taskTable.id, taskId))
    .returning()
    .execute();

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  return task;
}

export default deleteTask;
