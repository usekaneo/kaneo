import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishTaskMutation } from "./task-mutation-effects";

async function updateTaskPriority({
  id,
  priority,
  currentUserId,
}: {
  id: string;
  priority: string;
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

  const [updatedTask] = await db
    .update(taskTable)
    .set({ priority })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task priority",
    });
  }

  await publishTaskMutation(existingTask, updatedTask, currentUserId);

  return updatedTask;
}

export default updateTaskPriority;
