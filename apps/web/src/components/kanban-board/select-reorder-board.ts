import type { ProjectWithTasks } from "@/types/project";

export function selectReorderBoard(
  projectId: string,
  _taskId: string,
  cached: ProjectWithTasks | undefined,
  stored: ProjectWithTasks | null | undefined,
) {
  const current = cached?.id === projectId ? cached : undefined;
  const local = stored?.id === projectId ? stored : undefined;
  if (!current) return local;
  if (!local) return current;
  const ids = new Set(
    current.columns.flatMap((column) => column.tasks.map((task) => task.id)),
  );
  const created = local.columns
    .flatMap((column) => column.tasks)
    .filter((task) => !ids.has(task.id));
  if (!created.length) return current;
  return {
    ...current,
    columns: current.columns.map((column) => ({
      ...column,
      tasks: [
        ...column.tasks,
        ...created.filter((task) => task.status === column.slug),
      ],
    })),
  };
}
