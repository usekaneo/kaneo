import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTask(
  id: string,
  title: string,
  status: string,
  dueDate: Date,
  projectId: string,
  description: string,
  priority: string,
  position: number,
  userId?: string,
) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      title,
      status,
      dueDate,
      projectId,
      description,
      priority,
      position,
      userId: userId || null,
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
    });
  }

  if (existingTask.status !== status) {
    await publishEvent("task.status_changed", {
      taskId: updatedTask.id,
      userId: updatedTask.userId,
      oldStatus: existingTask.status,
      newStatus: status,
      title: updatedTask.title,
    });
  }

  if (existingTask.priority !== priority) {
    await publishEvent("task.priority_changed", {
      taskId: updatedTask.id,
      userId: updatedTask.userId,
      oldPriority: existingTask.priority,
      newPriority: priority,
      title: updatedTask.title,
    });
  }

  if (existingTask.userId !== userId) {
    await publishEvent("task.assignee_changed", {
      taskId: updatedTask.id,
      newAssignee: userId,
      title: updatedTask.title,
    });
  }

  return updatedTask;
}

export default updateTask;
