import { and, count, eq, gte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";

const DONE_STATUS_FALLBACK = ["done", "archived"] as const;
const IN_PROGRESS_STATUS_FALLBACK = ["in-progress", "in-review"] as const;

type ColumnMetric = {
  id: string | null;
  name: string;
  slug: string;
  color: string | null;
  position: number;
  isFinal: boolean;
  count: number;
};

type AssigneeMetric = {
  userId: string | null;
  name: string;
  email: string | null;
  image: string | null;
  assigned: number;
  done: number;
  inProgress: number;
};

type StatusCount = {
  status: string;
  count: number;
};

type PriorityCount = {
  priority: string;
  count: number;
};

type ActivityPoint = {
  date: string;
  created: number;
  completed: number;
};

export type ProjectMetrics = {
  projectId: string;
  projectName: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    unassignedTasks: number;
    overdueTasks: number;
    completionPercentage: number;
  };
  columns: ColumnMetric[];
  assignees: AssigneeMetric[];
  contracts: {
    total: number;
    byStatus: StatusCount[];
  };
  priority: PriorityCount[];
  activity: ActivityPoint[];
};

async function getProjectMetrics(
  projectId: string,
  workspaceId: string,
): Promise<ProjectMetrics> {
  const project = await db.query.projectTable.findFirst({
    where: and(
      eq(projectTable.id, projectId),
      eq(projectTable.workspaceId, workspaceId),
    ),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const columns = await db
    .select({
      id: columnTable.id,
      name: columnTable.name,
      slug: columnTable.slug,
      color: columnTable.color,
      position: columnTable.position,
      isFinal: columnTable.isFinal,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(columnTable.position);

  const finalSlugs = columns
    .filter((column) => column.isFinal)
    .map((column) => column.slug);
  const doneSlugs = [...new Set([...finalSlugs, ...DONE_STATUS_FALLBACK])];
  const inProgressSlugs = columns
    .filter(
      (column) =>
        !column.isFinal &&
        !["backlog", "to-do", "todo", "planned"].includes(column.slug),
    )
    .map((column) => column.slug);
  const activeInProgressSlugs = [
    ...new Set([
      ...(inProgressSlugs.length > 0
        ? inProgressSlugs
        : [...IN_PROGRESS_STATUS_FALLBACK]),
    ]),
  ];

  const doneSqlList = sql.join(
    doneSlugs.map((slug) => sql`${slug}`),
    sql`, `,
  );
  const inProgressSqlList = sql.join(
    activeInProgressSlugs.map((slug) => sql`${slug}`),
    sql`, `,
  );

  const [summaryRow] = await db
    .select({
      totalTasks: count(),
      completedTasks: count(
        sql`case when ${taskTable.status} in (${doneSqlList}) then 1 end`,
      ),
      inProgressTasks: count(
        sql`case when ${taskTable.status} in (${inProgressSqlList}) then 1 end`,
      ),
      unassignedTasks: count(
        sql`case when ${taskTable.userId} is null then 1 end`,
      ),
      overdueTasks: count(
        sql`case when ${taskTable.dueDate} is not null and ${taskTable.dueDate} < now() and ${taskTable.status} not in (${doneSqlList}) then 1 end`,
      ),
    })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  const totalTasks = Number(summaryRow?.totalTasks ?? 0);
  const completedTasks = Number(summaryRow?.completedTasks ?? 0);
  const inProgressTasks = Number(summaryRow?.inProgressTasks ?? 0);
  const unassignedTasks = Number(summaryRow?.unassignedTasks ?? 0);
  const overdueTasks = Number(summaryRow?.overdueTasks ?? 0);

  const statusCounts = await db
    .select({
      status: taskTable.status,
      count: count(),
    })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId))
    .groupBy(taskTable.status);

  const statusCountMap = new Map(
    statusCounts.map((row) => [row.status, Number(row.count)]),
  );

  const columnMetrics: ColumnMetric[] = columns.map((column) => ({
    id: column.id,
    name: column.name,
    slug: column.slug,
    color: column.color,
    position: column.position,
    isFinal: column.isFinal,
    count: statusCountMap.get(column.slug) ?? 0,
  }));

  // Tasks whose status no longer matches a board column (orphaned / renamed).
  const knownSlugs = new Set(columns.map((column) => column.slug));
  for (const [status, taskCount] of statusCountMap) {
    if (!knownSlugs.has(status) && taskCount > 0) {
      columnMetrics.push({
        id: null,
        name: status,
        slug: status,
        color: null,
        position: columnMetrics.length,
        isFinal: DONE_STATUS_FALLBACK.includes(
          status as (typeof DONE_STATUS_FALLBACK)[number],
        ),
        count: taskCount,
      });
    }
  }

  const assigneeRows = await db
    .select({
      userId: taskTable.userId,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      assigned: count(),
      done: count(
        sql`case when ${taskTable.status} in (${doneSqlList}) then 1 end`,
      ),
      inProgress: count(
        sql`case when ${taskTable.status} in (${inProgressSqlList}) then 1 end`,
      ),
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(eq(taskTable.projectId, projectId))
    .groupBy(
      taskTable.userId,
      userTable.name,
      userTable.email,
      userTable.image,
    );

  const assignees: AssigneeMetric[] = assigneeRows
    .map((row) => ({
      userId: row.userId,
      name: row.userId ? (row.name ?? "Usuário") : "Sem responsável",
      email: row.email ?? null,
      image: row.image ?? null,
      assigned: Number(row.assigned),
      done: Number(row.done),
      inProgress: Number(row.inProgress),
    }))
    .sort((a, b) => b.assigned - a.assigned);

  // Contract submissions are not on this branch yet — keep shape for the UI.
  const contractsByStatus: StatusCount[] = [];
  const contractsTotal = 0;

  const priorityRows = await db
    .select({
      priority: taskTable.priority,
      count: count(),
    })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId))
    .groupBy(taskTable.priority);

  const priority: PriorityCount[] = priorityRows.map((row) => ({
    priority: row.priority ?? "low",
    count: Number(row.count),
  }));

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);

  const createdRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${taskTable.createdAt}), 'YYYY-MM-DD')`,
      count: count(),
    })
    .from(taskTable)
    .where(
      and(eq(taskTable.projectId, projectId), gte(taskTable.createdAt, since)),
    )
    .groupBy(sql`date_trunc('day', ${taskTable.createdAt})`);

  // Approximate completions: tasks currently in a done column whose last update
  // falls in the window (status_changed events are not queried here).
  const completedRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${taskTable.updatedAt}), 'YYYY-MM-DD')`,
      count: count(),
    })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        gte(taskTable.updatedAt, since),
        sql`${taskTable.status} in (${doneSqlList})`,
      ),
    )
    .groupBy(sql`date_trunc('day', ${taskTable.updatedAt})`);

  const createdMap = new Map(
    createdRows.map((row) => [row.date, Number(row.count)]),
  );
  const completedMap = new Map(
    completedRows.map((row) => [row.date, Number(row.count)]),
  );

  const activity: ActivityPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    activity.push({
      date: key,
      created: createdMap.get(key) ?? 0,
      completed: completedMap.get(key) ?? 0,
    });
  }

  return {
    projectId: project.id,
    projectName: project.name,
    summary: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      unassignedTasks,
      overdueTasks,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    columns: columnMetrics,
    assignees,
    contracts: {
      total: contractsTotal,
      byStatus: contractsByStatus,
    },
    priority,
    activity,
  };
}

export default getProjectMetrics;
