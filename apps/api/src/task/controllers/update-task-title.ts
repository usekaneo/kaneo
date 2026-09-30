import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import {
  publishTaskMutation,
  recordTaskMutation,
} from "./task-mutation-effects";

async function updateTaskTitle({
  id,
  title,
  currentUserId,
}: {
  id: string;
  title: string;
  currentUserId: string;
}) {
  let existingTask = await db.query.taskTable.findFirst({
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
    const [locked] = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.id, id))
      .for("update");
    if (!locked) throw new HTTPException(404, { message: "Task not found" });
    existingTask = locked;

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

    await recordTaskMutation(tx, existingTask, { title }, currentUserId);

    return task;
  });

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["title"],
  });

  return updatedTask;
}

export default updateTaskTitle;
