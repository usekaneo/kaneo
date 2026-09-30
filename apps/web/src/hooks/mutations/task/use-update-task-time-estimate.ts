import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskTimeEstimate from "@/fetchers/task/update-task-time-estimate";
import type Task from "@/types/task";

export function useUpdateTaskTimeEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskTimeEstimate(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
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
