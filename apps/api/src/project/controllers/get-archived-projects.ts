import { and, desc, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function getArchivedProjects(workspaceId: string) {
  const projects = await db.query.projectTable.findMany({
    where: and(
      eq(projectTable.workspaceId, workspaceId),
      isNotNull(projectTable.archivedAt),
    ),
    with: {
      tasks: true,
    },
    orderBy: [desc(projectTable.archivedAt)],
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

export default getArchivedProjects;
