import { and, asc, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import duplicateTask from "../controllers/duplicate-task";
import { taskIsCompleted } from "../task-is-completed";
import { nextOccurrenceDates } from "./next-occurrence-date";

// Creates the next task of a recurring series once the task sits in a final
// column. The copy lands in the project's first open column, with its dates
// moved forward one step from the completed task's due date.
export async function createNextOccurrence(
  taskId: string,
  currentUserId: string | null | undefined,
) {
  const [task] = await db
    .select({
      projectId: taskTable.projectId,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      recurrence: taskTable.recurrence,
    })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.id, taskId),
        isNotNull(taskTable.recurrence),
        taskIsCompleted,
      ),
    )
    .limit(1);
  if (!task?.recurrence) return null;

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

  return duplicateTask({
    taskId,
    currentUserId: currentUserId ?? "",
    canUpdateTasks: true,
    occurrence: {
      status: openColumn.slug,
      ...nextOccurrenceDates(task, task.recurrence, new Date()),
    },
  });
}
