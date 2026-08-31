import { useMutation, useQueryClient } from "@tanstack/react-query";
import reorderTasks, {
  type TaskReorderInput,
} from "@/fetchers/task/reorder-tasks";

type ReorderTasksVariables = {
  projectId: string;
  tasks: TaskReorderInput[];
  /**
   * Whether the drag moved a task into a different column. A pure reorder
   * changes no status, so it cannot affect task counts, activity, or
   * notifications, and those queries are left alone.
   */
  crossedColumns?: boolean;
};

/**
 * One request per board drag.
 *
 * Dragging a card renumbers its neighbours, and doing that through
 * `useUpdateTask` meant one PUT plus five query invalidations per affected
 * task -- dozens of requests for a single drop on a busy column. Both sides
 * are batched here: a single request, and a single round of invalidation once
 * it lands.
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, tasks }: ReorderTasksVariables) =>
      reorderTasks(projectId, tasks),
    onSettled: (_data, _error, variables) => {
      // Reconciles the optimistic board state with the server, and on failure
      // is what puts the dragged card back where it really is.
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });

      if (!variables.crossedColumns) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      // Detail and activity views for the moved tasks. These only refetch when
      // such a view is actually mounted, so this stays cheap.
      for (const task of variables.tasks) {
        queryClient.invalidateQueries({ queryKey: ["task", task.id] });
        queryClient.invalidateQueries({ queryKey: ["activities", task.id] });
      }
    },
  });
}

export default useReorderTasks;
