import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskTimeEstimate({
  id,
  timeEstimate,
  currentUserId,
}: {
  id: string;
  timeEstimate: number | null;
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
    .set({ timeEstimate: timeEstimate || null })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task time estimate",
    });
  }

  await publishEvent("task.time_estimate_changed", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    userId: currentUserId,
    oldTimeEstimate: existingTask.timeEstimate,
    newTimeEstimate: updatedTask.timeEstimate,
    title: updatedTask.title,
    type: "time_estimate_changed",
  });

  return updatedTask;
}

export default updateTaskTimeEstimate;
