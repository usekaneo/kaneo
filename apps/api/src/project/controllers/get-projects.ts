import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function getProjects(workspaceId: string, includeArchived = false) {
  const projects = await db.query.projectTable.findMany({
    where: includeArchived
      ? eq(projectTable.workspaceId, workspaceId)
      : and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
        ),
    with: {
      tasks: true,
    },
  });

  const projectsWithStatistics = projects.map((project) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === "done" || task.status === "archived",
    ).length;
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const dueDate = project.tasks.reduce((earliest: Date | null, task) => {
      if (!earliest || (task.dueDate && task.dueDate < earliest))
        return task.dueDate;
      return earliest;
    }, null);

    return {
      ...project,
      statistics: {
        completionPercentage,
        totalTasks,
        dueDate,
      },
      archivedTasks: [],
      plannedTasks: [],
      columns: [],
    };
  });

  return projectsWithStatistics;
}

export default getProjects;
