import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function updateTaskTitle({
  id,
  title,
  currentUserId,
}: {
  id: string;
  title: string;
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

  if (existingTask.title === title) return existingTask;

  // Audit history is not best-effort. Commit the title and its immutable
  // history row atomically; event subscribers remain notifications/integrations
  // only and cannot make the audit trail disappear.
  const updatedTask = await db.transaction(async (tx) => {
    const [task] = await tx
      .update(taskTable)
      .set({ title })
      .where(eq(taskTable.id, id))
      .returning();

    if (!task) {
      throw new HTTPException(500, {
        message: "Failed to update task title",
      });
    }

    await tx.insert(activityTable).values({
      taskId: task.id,
      type: "title_changed",
      userId: currentUserId,
      content: null,
      eventData: { oldTitle: existingTask.title, newTitle: title },
    });

    return task;
  });

  await publishEvent("task.title_changed", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    userId: currentUserId,
    oldTitle: existingTask.title,
    newTitle: title,
    type: "title_changed",
  });

  return updatedTask;
}

export default updateTaskTitle;
