import {
  and,
  asc,
  count,
  eq,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

// Workspace calendar fetches one visible grid at a time; keep a safety bound
// so a wide custom [from, to] cannot dump an unbounded result set.
export const SCHEDULED_TASKS_LIMIT = 500;

const scheduleStart = sql`coalesce(${taskTable.startDate}, ${taskTable.dueDate})`;
const scheduleEnd = sql`coalesce(${taskTable.dueDate}, ${taskTable.startDate})`;

export type GetScheduledTasksOptions = {
  from: Date;
  to: Date;
  assignedToMe?: boolean;
};

async function getScheduledTasks(
  workspaceId: string,
  userId: string,
  options: GetScheduledTasksOptions,
) {
  const scheduled = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    ne(taskTable.status, "archived"),
    or(isNotNull(taskTable.startDate), isNotNull(taskTable.dueDate)),
    // Range overlap on the coalesced schedule, so single-date tasks match too.
    sql`${scheduleStart} <= ${options.to}`,
    sql`${scheduleEnd} >= ${options.from}`,
    options.assignedToMe ? eq(taskTable.userId, userId) : undefined,
    projectAccessCondition(userId, projectTable.id),
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(scheduled);

  // Existing databases may contain duplicate slugs from concurrent column
  // creation. A lateral lookup must return at most one decoration per task.
  const statusColumn = db
    .select({ name: columnTable.name, icon: columnTable.icon })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, taskTable.projectId),
        eq(columnTable.slug, taskTable.status),
      ),
    )
    .orderBy(
      sql`case when ${columnTable.id} = ${taskTable.columnId} then 0 else 1 end`,
      asc(columnTable.position),
      asc(columnTable.createdAt),
      asc(columnTable.id),
    )
    .limit(1)
    .as("scheduled_status_column");

  const [tasks, [totals]] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        statusName: statusColumn.name,
        statusIcon: statusColumn.icon,
        priority: taskTable.priority,
        position: taskTable.position,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        createdAt: taskTable.createdAt,
        userId: taskTable.userId,
        assigneeId: userTable.id,
        assigneeName: userTable.name,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .leftJoinLateral(statusColumn, sql`true`)
      .where(scheduled)
      .orderBy(
        sql`${scheduleStart} asc`,
        asc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(SCHEDULED_TASKS_LIMIT),
    totalsQuery,
  ]);

  return {
    tasks,
    total: Number(totals?.total ?? 0),
  };
}

export default getScheduledTasks;
