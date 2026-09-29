import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

/** Preserve board-only metadata while applying a bounded task refresh. */
export function patchBoardTask(
  board: ProjectWithTasks,
  taskId: string,
  update?: Partial<Task>,
) {
  const existing = [
    ...board.columns.flatMap((column) => column.tasks),
    ...board.plannedTasks,
    ...board.archivedTasks,
  ].find((task) => task.id === taskId);
  const belongs = update && update.projectId === board.id;
  const task = belongs
    ? ({
        ...existing,
        ...update,
        assigneeId:
          "userId" in update
            ? (update.userId ?? null)
            : (existing?.assigneeId ?? null),
      } as Task)
    : undefined;
  const columns = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => task.id !== taskId),
  }));
  const plannedTasks = board.plannedTasks.filter((task) => task.id !== taskId);
  const archivedTasks = board.archivedTasks.filter(
    (task) => task.id !== taskId,
  );
  if (task) {
    const target =
      task.status === "planned"
        ? plannedTasks
        : task.status === "archived"
          ? archivedTasks
          : columns.find((column) => column.slug === task.status)?.tasks;
    if (!target) return null;
    target.push(task);
    target.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  }
  return { ...board, columns, plannedTasks, archivedTasks };
}
