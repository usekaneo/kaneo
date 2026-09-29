import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishTaskMutation } from "./task-mutation-effects";

async function updateTaskDescription({
  id,
  description,
  currentUserId,
}: {
  id: string;
  description: string;
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
    .set({ description })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task description",
    });
  }

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["description"],
  });

  return updatedTask;
}

export default updateTaskDescription;
