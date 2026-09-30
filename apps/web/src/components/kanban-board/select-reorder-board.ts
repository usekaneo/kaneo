import type { ProjectWithTasks } from "@/types/project";

export function selectReorderBoard(
  projectId: string,
  taskId: string,
  cached: ProjectWithTasks | undefined,
  stored: ProjectWithTasks | null | undefined,
) {
  const current = cached?.id === projectId ? cached : undefined;
  const local = stored?.id === projectId ? stored : undefined;
  if (!current) return local;
  if (
    current.columns.some((column) =>
      column.tasks.some((task) => task.id === taskId),
    )
  )
    return current;
  const created = local?.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === taskId);
  if (
    !created ||
    !current.columns.some((column) => column.slug === created.status)
  )
    return current;
  return {
    ...current,
    columns: current.columns.map((column) =>
      column.slug === created.status
        ? { ...column, tasks: [...column.tasks, created] }
        : column,
    ),
  };
}
