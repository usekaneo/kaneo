import { and, count, eq, inArray, isNull, min, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";

type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: Date | null;
};

const EMPTY_STATISTICS: ProjectStatistics = {
  completionPercentage: 0,
  totalTasks: 0,
  dueDate: null,
};

async function getProjectStatistics(projectIds: string[]) {
  const statisticsByProject = new Map<string, ProjectStatistics>();

  if (projectIds.length === 0) {
    return statisticsByProject;
  }

  // Aggregate in the database instead of loading every task row into memory.
  // This endpoint needs three numbers per project; the previous
  // `with: { tasks: true }` made both the query and the response grow linearly
  // with the number of tasks in the workspace.
  const rows = await db
    .select({
      projectId: taskTable.projectId,
      totalTasks: count(),
      completedTasks: count(
        sql`case when ${taskTable.status} in ('done', 'archived') then 1 end`,
      ),
      dueDate: min(taskTable.dueDate),
    })
    .from(taskTable)
    .where(inArray(taskTable.projectId, projectIds))
    .groupBy(taskTable.projectId);

  for (const row of rows) {
    const totalTasks = Number(row.totalTasks);
    const completedTasks = Number(row.completedTasks);

    statisticsByProject.set(row.projectId, {
      totalTasks,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      dueDate: row.dueDate ?? null,
    });
  }

  return statisticsByProject;
}

async function getProjects(workspaceId: string, includeArchived = false) {
  const projects = await db.query.projectTable.findMany({
    where: includeArchived
      ? eq(projectTable.workspaceId, workspaceId)
      : and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
        ),
  });

  const statisticsByProject = await getProjectStatistics(
    projects.map((project) => project.id),
  );

  return projects.map((project) => ({
    ...project,
    statistics: statisticsByProject.get(project.id) ?? EMPTY_STATISTICS,
    archivedTasks: [],
    plannedTasks: [],
    columns: [],
  }));
}

export default getProjects;
