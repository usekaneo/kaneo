import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

export function filterProjectTasks(
  project: ProjectWithTasks,
  keep: (task: Task) => boolean,
): ProjectWithTasks {
  return {
    ...project,
    columns: (project.columns ?? []).map((column) => ({
      ...column,
      tasks: column.tasks.filter(keep),
    })),
    plannedTasks: (project.plannedTasks ?? []).filter(keep),
    archivedTasks: (project.archivedTasks ?? []).filter(keep),
  };
}
