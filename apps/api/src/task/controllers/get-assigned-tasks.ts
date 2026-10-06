import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { taskIsCompleted } from "../task-is-completed";

// Home and My tasks render this list whole, so it stays one bounded page.
export const ASSIGNED_TASKS_LIMIT = 100;

const priorityRank = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

async function getAssignedTasks(
  workspaceId: string,
  userId: string,
  countOnly = false,
) {
  const openAndMine = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    eq(taskTable.userId, userId),
    ne(taskTable.status, "archived"),
    sql`not coalesce((
      select ${columnTable.isFinal} from ${columnTable}
      where ${columnTable.id} = ${taskTable.columnId}
        and ${columnTable.projectId} = ${taskTable.projectId}
    ), ${taskIsCompleted})`,
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(openAndMine);

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
        dueDate: taskTable.dueDate,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoinLateral(statusColumn, sql`true`)
      .where(openAndMine)
      .orderBy(
        sql`${taskTable.dueDate} asc nulls last`,
        desc(priorityRank),
        asc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(ASSIGNED_TASKS_LIMIT),
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

export default getAssignedTasks;
