import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskDescription from "@/fetchers/task/update-task-description";
import type Task from "@/types/task";

export function useUpdateTaskDescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskDescription(task.id, task),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", updated.projectId],
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
