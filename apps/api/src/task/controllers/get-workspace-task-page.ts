import { taskPriorityRank } from "../priority-rank";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ilike,
  or,
  type SQL,
  ne,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  taskCoAssigneeTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { hasTaskAssignee } from "../assignees/has-task-assignee";
import { taskIsCompleted } from "../task-is-completed";

// Each overview request returns compact summaries for one bounded page.
export const WORKSPACE_TASK_PAGE_SIZE = 100;

export type WorkspaceTaskFilters = {
  projectId?: string;
  assigneeId?: string;
  priority?: string;
  completion?: "open" | "completed" | "all";
  search?: string;
};

export default async function getWorkspaceTaskPage(
  workspaceId: string,
  userId: string,
  filters: WorkspaceTaskFilters,
  page = 1,
  countOnly = false,
) {
  const isCompleted = sql<boolean>`coalesce((
    select ${columnTable.isFinal} from ${columnTable}
    where ${columnTable.id} = ${taskTable.columnId}
      and ${columnTable.projectId} = ${taskTable.projectId}
  ), ${taskIsCompleted})`;
  const conditions: Array<SQL | undefined> = [
    filters.projectId ? eq(taskTable.projectId, filters.projectId) : undefined,
    filters.assigneeId === "unassigned"
      ? sql`${taskTable.userId} is null and not exists (select 1 from ${taskCoAssigneeTable} where ${taskCoAssigneeTable.taskId} = ${taskTable.id})`
      : filters.assigneeId
        ? hasTaskAssignee(filters.assigneeId)
        : undefined,
    filters.priority ? eq(taskTable.priority, filters.priority) : undefined,
    filters.completion === "all"
      ? undefined
      : filters.completion === "completed"
        ? isCompleted
        : sql`not ${isCompleted}`,
  ];
  const query = filters.search?.trim();
  if (query) {
    const literal = query.replace(/[\\%_]/g, "\\$&");
    conditions.push(
      or(
        ilike(taskTable.title, `%${literal}%`),
        ilike(
          sql`concat(${projectTable.slug}, '-', ${taskTable.number})`,
          `%${literal}%`,
        ),
      ),
    );
  }
  const matching = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    ne(taskTable.status, "archived"),
    ...conditions,
    projectAccessCondition(userId, projectTable.id),
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(matching);

  if (countOnly) {
    const [totals] = await totalsQuery;
    return { tasks: [], total: Number(totals?.total ?? 0) };
  }

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
    .as("assigned_status_column");

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
        completed: isCompleted,
        dueDate: taskTable.dueDate,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoinLateral(statusColumn, sql`true`)
      .where(matching)
      .orderBy(
        sql`${taskTable.dueDate} asc nulls last`,
        desc(taskPriorityRank),
        asc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(WORKSPACE_TASK_PAGE_SIZE)
      .offset((page - 1) * WORKSPACE_TASK_PAGE_SIZE),
    totalsQuery,
  ]);

  const labels = tasks.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(
          inArray(
            labelTable.taskId,
            tasks.map((task) => task.id),
          ),
        )
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const taskLabels = labelsByTask.get(taskId) ?? [];
    taskLabels.push(label);
    labelsByTask.set(taskId, taskLabels);
  }

  return {
    tasks: tasks.map((task) => ({
      ...task,
      labels: labelsByTask.get(task.id) ?? [],
    })),
    total: Number(totals?.total ?? 0),
  };
}
