import type { ProjectWithTasks } from "@/types/project";
import type { TaskWithExtras } from "./mock-data";

export type AssignedTask = TaskWithExtras & {
  projectName: string;
  projectSlug: string;
  statusName: string;
};

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Every task with the project context the workspace pages show beside it.
export function indexTasks(projects: ProjectWithTasks[]) {
  return new Map(
    projects.flatMap((project) =>
      project.columns.flatMap((column) =>
        column.tasks.map((task): [string, AssignedTask] => [
          task.id,
          {
            ...task,
            projectName: project.name,
            projectSlug: project.slug,
            statusName: column.name,
          },
        ]),
      ),
    ),
  );
}

// Mirrors GET /task/assigned: open tasks only, soonest due first.
export function getAssignedTasks(
  projects: ProjectWithTasks[],
  userId: string,
): AssignedTask[] {
  const finalStatuses = new Set(
    projects.flatMap((project) =>
      project.columns
        .filter((column) => column.isFinal)
        .map((column) => `${project.id}:${column.id}`),
    ),
  );

  return [...indexTasks(projects).values()]
    .filter(
      (task) =>
        task.userId === userId &&
        !finalStatuses.has(`${task.projectId}:${task.status}`),
    )
    .sort((left, right) => {
      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : null;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : null;
      if (leftDue !== rightDue) {
        if (leftDue === null) return 1;
        if (rightDue === null) return -1;
        return leftDue - rightDue;
      }
      return (
        (PRIORITY_RANK[right.priority ?? ""] ?? 0) -
        (PRIORITY_RANK[left.priority ?? ""] ?? 0)
      );
    });
}

export function getCompletionPercentage(project: ProjectWithTasks) {
  const tasks = project.columns.flatMap((column) => column.tasks);
  if (tasks.length === 0) return 0;
  const done = project.columns
    .filter((column) => column.isFinal)
    .reduce((sum, column) => sum + column.tasks.length, 0);
  return Math.round((done / tasks.length) * 100);
}
