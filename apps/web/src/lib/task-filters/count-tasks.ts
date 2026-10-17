import type { ProjectWithTasks } from "@/types/project";

type TaskSource = Pick<
  ProjectWithTasks,
  "columns" | "plannedTasks" | "archivedTasks"
>;

export function countColumnTasks(project: TaskSource | null | undefined) {
  return (
    project?.columns.reduce((sum, column) => sum + column.tasks.length, 0) ?? 0
  );
}

export function countBacklogTasks(project: TaskSource | null | undefined) {
  return (
    (project?.plannedTasks?.length ?? 0) + (project?.archivedTasks?.length ?? 0)
  );
}
