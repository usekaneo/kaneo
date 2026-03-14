import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import getTask from "./get-task";

async function deleteTask(taskId: string) {
  const task = await getTask(taskId);

  const [deletedTask] = await db
    .delete(taskTable)
    .where(eq(taskTable.id, taskId))
    .returning()
    .execute();

  if (!deletedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  return task;
}

export default deleteTask;
