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
  // Sprint-scheduled tasks are planned on the sprint planning view, so the
  // backlog counter only counts unscheduled planned tasks (tasks without a
  // sprint id), plus the archived ones.
  return (
    (project?.plannedTasks?.filter((task) => !task.sprintId).length ?? 0) +
    (project?.archivedTasks?.length ?? 0)
  );
}
