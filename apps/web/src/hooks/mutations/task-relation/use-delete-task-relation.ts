import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", taskId],
      });
      // The other end of the relation and the project-scoped list the list
      // view reads are both stale now, and neither is keyed by this task.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useDeleteTaskRelation;
