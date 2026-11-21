import type { ProjectWithTasks } from "@/types/project";
import { insertWorkspaceTask } from "@/lib/workspace-board/compare-workspace-tasks";

/**
 * Move one task into another merged column of a workspace board, for the
 * optimistic state between a drop and the server's answer. The card lands
 * where the server order puts it. Returns the same board when the task or
 * the column is unknown.
 */
export function moveWorkspaceTask<T extends ProjectWithTasks>(
  board: T,
  taskId: string,
  columnId: string,
): T {
  const target = board.columns.find((column) => column.id === columnId);
  const source = board.columns.find((column) =>
    column.tasks.some((task) => task.id === taskId),
  );
  if (!target || !source || target.id === source.id) return board;
  const moved = source.tasks.find((task) => task.id === taskId);
  if (!moved) return board;
  const task = { ...moved, status: target.slug };
  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.id === source.id)
        return {
          ...column,
          tasks: column.tasks.filter((item) => item.id !== taskId),
        };
      if (column.id === target.id)
        return { ...column, tasks: insertWorkspaceTask(column.tasks, task) };
      return column;
    }),
  };
}
