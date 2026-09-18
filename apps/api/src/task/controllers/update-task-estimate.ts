import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskEstimate({
  id,
  estimateMinutes,
  currentUserId,
}: {
  id: string;
  estimateMinutes: number | null;
  currentUserId: string;
}) {
  const [updatedTask] = await db
    .update(taskTable)
    .set({ estimateMinutes })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  // Refreshes open boards and task views; an estimate is not activity-worthy.
  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    userId: currentUserId,
  });

  return updatedTask;
}

export default updateTaskEstimate;
