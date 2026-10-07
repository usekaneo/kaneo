import { and, asc, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import duplicateTask from "../controllers/duplicate-task";
import { taskIsCompleted } from "../task-is-completed";

// Creates the next task of a recurring series once the task sits in a final
// column. The copy lands in the project's first open column, with its dates
// moved forward one step from the completed task's due date.
export async function createNextOccurrence(
  taskId: string,
  currentUserId: string | null | undefined,
) {
  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.id, taskId),
        isNotNull(taskTable.recurrence),
        taskIsCompleted,
      ),
    )
    .limit(1);
  if (!task) return null;

  const [openColumn] = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, task.projectId),
        eq(columnTable.isFinal, false),
      ),
    )
    .orderBy(asc(columnTable.position))
    .limit(1);
  if (!openColumn) return null;

  const next = await duplicateTask({
    taskId,
    currentUserId: currentUserId ?? "",
    canUpdateTasks: true,
    occurrence: { status: openColumn.slug, completedAt: new Date() },
  });
  // Clients refetched the completed task on its status change, before its rule
  // moved, so they still show it as repeating.
  if (next)
    await publishEvent("task.updated", {
      taskId,
      projectId: task.projectId,
      userId: currentUserId,
    });
  return next;
}
