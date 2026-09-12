import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: (deleted) => {
      // Both ends go stale, and only one of them is the task this hook was
      // opened for. Queries default to refetchOnMount: false, so opening the
      // other task would otherwise still list the relation.
      const endpoints = new Set([
        taskId,
        deleted.sourceTaskId,
        deleted.targetTaskId,
      ]);
      for (const endpoint of endpoints) {
        queryClient.invalidateQueries({
          queryKey: ["task-relations", endpoint],
        });
      }
      // The project-scoped query the list view reads is keyed by neither, and
      // the prefix covers every project a mounted view holds.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useDeleteTaskRelation;
