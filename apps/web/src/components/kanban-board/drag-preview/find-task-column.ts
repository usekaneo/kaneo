import type { ProjectWithTasks } from "@/types/project";

export function findTaskColumn(board: ProjectWithTasks, id: string) {
  return board.columns.find(
    (column) => column.id === id || column.tasks.some((task) => task.id === id),
  );
}
