import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskEstimate from "@/fetchers/task/update-task-estimate";

export function useUpdateTaskEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      estimateMinutes,
    }: {
      taskId: string;
      projectId: string;
      estimateMinutes: number | null;
    }) => updateTaskEstimate(taskId, estimateMinutes),
    onSuccess: (_, { taskId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}
