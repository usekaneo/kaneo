import type { QueryClient } from "@tanstack/react-query";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type BoardTasks = Pick<ProjectWithTasks, "columns" | "plannedTasks"> & {
  archivedTasks?: Task[];
};

function findBoardTask(board: BoardTasks, taskId: string): Task | undefined {
  for (const column of board.columns) {
    const task = column.tasks.find((candidate) => candidate.id === taskId);
    if (task) return task;
  }
  return [...(board.plannedTasks ?? []), ...(board.archivedTasks ?? [])].find(
    (candidate) => candidate.id === taskId,
  );
}

export function findCachedTask(
  queryClient: QueryClient,
  taskId: string,
): Task | undefined {
  const boards = queryClient.getQueriesData<BoardTasks>({
    queryKey: ["tasks"],
    predicate: (query) => query.queryKey.length === 2,
  });
  for (const [, board] of boards) {
    const task = board?.columns ? findBoardTask(board, taskId) : undefined;
    if (task) return task;
  }
  return queryClient.getQueryData<Task>(["task", taskId]);
}
