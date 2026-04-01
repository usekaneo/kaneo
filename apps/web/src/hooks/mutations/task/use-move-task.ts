import { useMutation, useQueryClient } from "@tanstack/react-query";
import moveTask from "@/fetchers/task/move-task";

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveTask,
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", result.sourceProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", result.destinationProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
  });
}
