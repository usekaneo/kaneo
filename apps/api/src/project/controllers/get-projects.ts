import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

const EXCLUDED_TASK_STATUSES = new Set(["archived", "deleted"]);

type TaskSummary = {
  status: string;
  dueDate: Date | null;
};

function isActiveTask(task: TaskSummary): boolean {
  return !EXCLUDED_TASK_STATUSES.has(task.status);
}

function buildTaskCountByStatus(tasks: TaskSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const task of tasks) {
    if (!isActiveTask(task)) continue;
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }

  return counts;
}

function buildStatistics(activeTasks: TaskSummary[]) {
  const totalTasks = activeTasks.length;
  const completedTasks = activeTasks.filter(
    (task) => task.status === "done",
  ).length;
  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const dueDate = activeTasks.reduce((earliest: Date | null, task) => {
    if (!earliest || (task.dueDate && task.dueDate < earliest)) {
      return task.dueDate;
    }
    return earliest;
  }, null);

  return {
    completionPercentage,
    totalTasks,
    dueDate,
  };
}

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

  return projects.map(({ tasks, ...project }) => {
    const activeTasks = tasks.filter(isActiveTask);
    const taskCountByStatus = buildTaskCountByStatus(tasks);

    return {
      ...project,
      taskCountByStatus,
      totalActiveTasks: activeTasks.length,
      statistics: buildStatistics(activeTasks),
    };
  });
}

export default getProjects;
