import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: (relation) => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", taskId],
      });
      // The API returns the deleted relation's actual endpoints, which may
      // differ from `taskId` (the panel this mutation was opened from) — the
      // OTHER endpoint's own per-task cache needs invalidating too, or its
      // relation list keeps showing the removed link until something else
      // refetches it.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", relation.sourceTaskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", relation.targetTaskId],
      });
      // Same reasoning as the create mutation: which project(s) the two
      // tasks belong to isn't known here, so every project's Gantt cache is
      // invalidated rather than none of them.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useDeleteTaskRelation;
