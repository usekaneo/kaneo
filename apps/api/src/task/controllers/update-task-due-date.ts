import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskReminderSentTable, taskTable } from "../../database/schema";

async function updateTaskDueDate({
  id,
  dueDate,
}: {
  id: string;
  dueDate: Date | null;
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

  return updatedTask;
}

export default updateTaskDueDate;
