import { and, desc, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";

const RECENTLY_DONE_DAYS = 30;

// Everything assigned to a person across the workspace, through the normal
// task assignee. Open work first, plus what they finished recently.
async function getPersonTasks(workspaceId: string, userId: string) {
  const recent = new Date(
    Date.now() - RECENTLY_DONE_DAYS * 24 * 60 * 60 * 1000,
  );
  const done = sql<boolean>`coalesce(${columnTable.isFinal}, false)`;

  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      dueDate: taskTable.dueDate,
      estimateMinutes: taskTable.estimateMinutes,
      // Per-task sum through time_entry_taskId_idx; only assigned tasks pay it.
      trackedSeconds: sql<number>`(select coalesce(sum(${timeEntryTable.duration}), 0)::int from ${timeEntryTable} where ${timeEntryTable.taskId} = ${taskTable.id})`,
      done,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        eq(taskTable.userId, userId),
        ne(taskTable.status, "archived"),
        or(
          isNull(columnTable.isFinal),
          eq(columnTable.isFinal, false),
          gte(taskTable.updatedAt, recent),
        ),
      ),
    )
    .orderBy(
      done,
      sql`${taskTable.dueDate} asc nulls last`,
      desc(taskTable.updatedAt),
    );
}

export default getPersonTasks;
