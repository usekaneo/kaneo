import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function getProjects(workspaceId: string) {
  const projects = await db.query.projectTable.findMany({
    where: eq(projectTable.workspaceId, workspaceId),
    with: {
      tasks: true,
    },
  });

  const projectsWithStatistics = projects.map((project) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === "done",
    ).length;
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...project,
      statistics: {
        completionPercentage,
        totalTasks,
      },
      archivedTasks: [],
      plannedTasks: [],
      columns: [],
    };
  });

  return projectsWithStatistics;
}

export default getProjects;
