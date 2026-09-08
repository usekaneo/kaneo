import type { ProjectWithTasks } from "@/types/project";

export function removeTaskFromProject(
  project: ProjectWithTasks,
  taskId: string,
): ProjectWithTasks {
  return {
    ...project,
    columns: project.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => task.id !== taskId),
    })),
    plannedTasks: project.plannedTasks.filter((task) => task.id !== taskId),
    archivedTasks: project.archivedTasks.filter((task) => task.id !== taskId),
  };
}
