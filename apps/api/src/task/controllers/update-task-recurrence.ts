import { and, eq, isNotNull, not, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import type { TaskRecurrence } from "../recurrence/schema";
import { taskIsCompleted } from "../task-is-completed";

async function updateTaskRecurrence({
  id,
  recurrence,
  currentUserId,
}: {
  id: string;
  recurrence: TaskRecurrence | null;
  currentUserId: string;
}) {
  // A completed task can only edit the rule it has yet to hand over. Setting
  // one after its next task took the rule would start a second series, so the
  // check runs in the update and rechecks the row once a claim releases it.
  const [task] = await db
    .update(taskTable)
    .set({ recurrence })
    .where(
      and(
        eq(taskTable.id, id),
        recurrence
          ? or(not(taskIsCompleted), isNotNull(taskTable.recurrence))
          : undefined,
      ),
    )
    .returning();

  if (!task) {
    const exists = await db.query.taskTable.findFirst({
      columns: { id: true },
      where: eq(taskTable.id, id),
    });
    if (exists)
      throw new HTTPException(409, {
        message: "Reopen the task to make it repeat",
      });
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
