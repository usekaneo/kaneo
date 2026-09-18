import { useMutation, useQueryClient } from "@tanstack/react-query";
import createQuickTask from "@/fetchers/task/create-quick-task";

function useCreateQuickTask(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuickTask,
    onSuccess: (task) => {
      void queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["people", workspaceId] });
      // The first task without a project creates the "Daily Task" project.
      void queryClient.invalidateQueries({
        queryKey: ["projects", workspaceId],
      });
    },
  });
}

export default useCreateQuickTask;
