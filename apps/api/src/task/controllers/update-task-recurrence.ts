import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import type { TaskRecurrence } from "../recurrence/schema";

async function updateTaskRecurrence({
  id,
  recurrence,
  currentUserId,
}: {
  id: string;
  recurrence: TaskRecurrence | null;
  currentUserId: string;
}) {
  const [task] = await db
    .update(taskTable)
    .set({ recurrence })
    .where(eq(taskTable.id, id))
    .returning();

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  await publishEvent("task.updated", {
    taskId: task.id,
    projectId: task.projectId,
    userId: currentUserId,
  });

  return task;
}

export default updateTaskRecurrence;
