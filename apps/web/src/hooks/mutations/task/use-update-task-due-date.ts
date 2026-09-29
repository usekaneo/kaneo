import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskDueDate from "@/fetchers/task/update-task-due-date";
import type Task from "@/types/task";
import { updateBoardTaskCache } from "@/lib/update-board-task-cache";

export function useUpdateTaskDueDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskDueDate(task.id, task),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      updateBoardTaskCache(queryClient, variables.projectId, variables.id, {
        dueDate: updated.dueDate,
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
    },
  });
}
