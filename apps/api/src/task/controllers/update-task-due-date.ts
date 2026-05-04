import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskReminderSentTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskDueDate({
  id,
  dueDate,
  currentUserId,
}: {
  id: string;
  dueDate: Date | null;
  currentUserId: string;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  // Clear sent reminders so new due date triggers fresh notifications
  await db
    .delete(taskReminderSentTable)
    .where(eq(taskReminderSentTable.taskId, id));

  const [updatedTask] = await db
    .update(taskTable)
    .set({ dueDate: dueDate || null })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task due date",
    });
  }

  await publishEvent("task.due_date_changed", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    userId: currentUserId,
    oldDueDate: existingTask.dueDate,
    newDueDate: dueDate,
    title: updatedTask.title,
    type: "due_date_changed",
  });

  return updatedTask;
}

export default updateTaskDueDate;
