import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskType from "@/fetchers/task/update-task-type";
import type Task from "@/types/task";

export function useUpdateTaskType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskType(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
    },
  });
}
