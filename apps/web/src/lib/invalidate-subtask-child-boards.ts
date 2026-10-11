import type { QueryClient } from "@tanstack/react-query";
import type { ProjectWithTasks } from "@/types/project";

export function invalidateSubtaskChildBoards(
  queryClient: QueryClient,
  parentTaskId: string,
) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== "tasks") return false;
      const board = queryClient.getQueryData<ProjectWithTasks>(query.queryKey);
      if (!board) return false;
      return [
        ...board.columns.flatMap((column) => column.tasks),
        ...board.plannedTasks,
        ...board.archivedTasks,
      ].some((task) =>
        task.subtaskParents?.some((parent) => parent.id === parentTaskId),
      );
    },
  });
}
