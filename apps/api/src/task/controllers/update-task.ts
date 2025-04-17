import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTask(
  taskId: string,
  title: string,
  status: string,
  dueDate: Date,
  projectId: string,
  description?: string,
  priority?: string,
  position?: number,
  userEmail?: string,
) {
  const [existingTask] = await db
    .select()
    .from(taskTable)
    .where(eq(taskTable.id, taskId));

  const isTaskExisting = Boolean(existingTask);

  if (!isTaskExisting) {
    throw new HTTPException(404, {
      message: "Task doesn't exist",
    });
  }

  const userEmailToUpdate = userEmail?.length ? userEmail : null;

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      title,
      description,
      status,
      dueDate,
      priority,
      userEmail: userEmailToUpdate,
      position,
      projectId,
    })
    .where(eq(taskTable.id, taskId))
    .returning();

  return updatedTask;
}

export default updateTask;
