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
  userEmail?: string,
  source?: string, // Add source parameter for loop prevention
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
      userEmail: userEmail || null,
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
      userEmail: updatedTask.userEmail,
      oldStatus: existingTask.status,
      newStatus: status,
      title: updatedTask.title,
    });
  }

  if (existingTask.priority !== priority) {
    await publishEvent("task.priority_changed", {
      taskId: updatedTask.id,
      userEmail: updatedTask.userEmail,
      oldPriority: existingTask.priority,
      newPriority: priority,
      title: updatedTask.title,
    });
  }

  if (existingTask.userEmail !== userEmail) {
    await publishEvent("task.assignee_changed", {
      taskId: updatedTask.id,
      newAssignee: userEmail,
      title: updatedTask.title,
    });
  }

  // Publish general task updated event for any other changes
  if (
    existingTask.title !== title ||
    existingTask.description !== description
  ) {
    await publishEvent("task.updated", {
      taskId: updatedTask.id,
      userEmail: updatedTask.userEmail,
      oldTitle: existingTask.title,
      newTitle: title,
      oldDescription: existingTask.description,
      newDescription: description,
      title: updatedTask.title,
      source, // Include source in the event
    });
  }

  return updatedTask;
}

export default updateTask;
