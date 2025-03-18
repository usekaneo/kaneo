import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";

async function updateTask(
  taskId: string,
  body: {
    projectId: string;
    userEmail: string;
    title: string;
    status: string;
    dueDate: Date | null;
    description: string;
    priority: string;
    position: number;
  },
) {
  const [existingTask] = await db
    .select()
    .from(taskTable)
    .where(eq(taskTable.id, taskId));

  const isTaskExisting = Boolean(existingTask);

  if (!isTaskExisting) {
    throw new Error("Task doesn't exist");
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      title: body.title,
      description: body.description,
      status: body.status,
      dueDate: new Date(body.dueDate ?? ""),
      priority: body.priority,
      userEmail: body.userEmail,
      position: body.position,
    })
    .where(eq(taskTable.id, taskId))
    .returning();

  return updatedTask;
}

export default updateTask;
