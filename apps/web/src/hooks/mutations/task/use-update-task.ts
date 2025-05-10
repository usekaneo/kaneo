import updateTask from "@/fetchers/task/update-task";
import type Task from "@/types/task";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, task),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.refetchQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.refetchQueries({
        queryKey: ["notifications"],
      });
    },
  });
}

export default useUpdateTask;
