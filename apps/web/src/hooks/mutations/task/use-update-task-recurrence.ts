import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskRecurrence from "@/fetchers/task/update-task-recurrence";
import {
  getBoardCacheVersion,
  markBoardCacheChanged,
} from "@/lib/board-cache-version";
import { updateBoardTaskCache } from "@/lib/update-board-task-cache";
import type Task from "@/types/task";
import type { TaskRecurrence } from "@/types/task/recurrence";

type Variables = { task: Task; recurrence: TaskRecurrence | null };

export function useUpdateTaskRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ task, recurrence }: Variables) =>
      updateTaskRecurrence(task.id, recurrence),
    // The picker edits the rule in place, so it shows each change right away.
    onMutate: async ({ task, recurrence }: Variables) => {
      markBoardCacheChanged(queryClient, task.projectId, task.id);
      const queryKey = ["task", task.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<Task>(queryKey, (current) =>
        current ? { ...current, recurrence } : current,
      );
      return {
        previous,
        version: getBoardCacheVersion(queryClient, task.projectId, task.id),
      };
    },
    onError: (_error, { task }, context) => {
      queryClient.setQueryData(["task", task.id], context?.previous);
    },
    onSuccess: (updated, { task }, context) => {
      updateBoardTaskCache(
        queryClient,
        task.projectId,
        task.id,
        { recurrence: updated.recurrence ?? null },
        context?.version,
      );
    },
    onSettled: (_data, _error, { task }) => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    },
  });
}
