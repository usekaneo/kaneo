import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

// Baseline (plan vs actual) is intentionally minimal: a snapshot of the
// task's current startDate/dueDate, taken on demand rather than tracked
// automatically. Reusing "task.updated" (already broadcast to the project
// and invalidated on the web client) is enough for the Gantt underlay to
// refresh; a dedicated activity/notification entry would be noise for what
// is essentially bookmarking two dates.
async function setTaskBaseline({
  id,
  currentUserId,
}: {
  id: string;
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
    .set({
      baselineStartDate: existingTask.startDate,
      baselineDueDate: existingTask.dueDate,
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to set task baseline",
    });
  }

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

async function clearTaskBaseline({
  id,
  currentUserId,
}: {
  id: string;
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
    .set({
      baselineStartDate: null,
      baselineDueDate: null,
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to clear task baseline",
    });
  }

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

export { clearTaskBaseline, setTaskBaseline };
