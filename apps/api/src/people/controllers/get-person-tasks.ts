import { and, desc, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../database";
import {
  activityTable,
  columnTable,
  projectTable,
  taskAttachmentTable,
  taskRelationTable,
  taskTable,
  timeEntryTable,
  userTable,
  userTaskOrderTable,
} from "../../database/schema";

const RECENTLY_DONE_DAYS = 30;

// Everything assigned to a person across the workspace, through the normal
// task assignee. Open work first, plus what they finished recently.
async function getPersonTasks(workspaceId: string, userId: string) {
  const recent = new Date(
    Date.now() - RECENTLY_DONE_DAYS * 24 * 60 * 60 * 1000,
  );
  const done = sql<boolean>`coalesce(${columnTable.isFinal}, false)`;
  // Whoever last put the task on its current assignee: the latest assignment
  // change, or the creator when it was assigned at creation. Both are recorded
  // in activity with the acting user, so no extra column is needed.
  const assignedById = sql<
    string | null
  >`(select ${activityTable.userId} from ${activityTable} where ${activityTable.taskId} = ${taskTable.id} and ${activityTable.type} in ('created', 'assignee_changed') order by ${activityTable.createdAt} desc limit 1)`;
  const assigner = alias(userTable, "assigner");

  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      statusName: columnTable.name,
      statusIcon: columnTable.icon,
      priority: taskTable.priority,
      dueDate: taskTable.dueDate,
      estimateMinutes: taskTable.estimateMinutes,
      // Per-task sum through time_entry_taskId_idx; only assigned tasks pay it.
      trackedSeconds: sql<number>`(select coalesce(sum(${timeEntryTable.duration}), 0)::int from ${timeEntryTable} where ${timeEntryTable.taskId} = ${taskTable.id})`,
      done,
      assignedById: assigner.id,
      assignedByName: assigner.name,
      assignedByImage: assigner.image,
      attachmentCount: sql<number>`(select count(*)::int from ${taskAttachmentTable} where ${taskAttachmentTable.taskId} = ${taskTable.id})`,
      // Subtasks across all checklists; done means in a final column. The
      // inner task/column are aliased so taskTable.id still means the outer row.
      subtaskTotal: sql<number>`(select count(*)::int from ${taskRelationTable} tr where tr.source_task_id = ${taskTable.id} and tr.relation_type = 'subtask')`,
      subtaskDone: sql<number>`(select count(*)::int from ${taskRelationTable} tr join ${taskTable} st on st.id = tr.target_task_id left join ${columnTable} sc on sc.id = st.column_id where tr.source_task_id = ${taskTable.id} and tr.relation_type = 'subtask' and coalesce(sc.is_final, false))`,
      createdAt: taskTable.createdAt,
      myPosition: userTaskOrderTable.position,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
    .leftJoin(assigner, eq(assigner.id, assignedById))
    .leftJoin(
      userTaskOrderTable,
      and(
        eq(userTaskOrderTable.taskId, taskTable.id),
        eq(userTaskOrderTable.userId, userId),
      ),
    )
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
