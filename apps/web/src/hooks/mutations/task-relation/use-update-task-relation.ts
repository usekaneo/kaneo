import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskRelation from "@/fetchers/task-relation/update-task-relation";

function useUpdateTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTaskRelation,
    onSuccess: (relation) => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", taskId],
      });
      // Same reasoning as the create/delete mutations: the other endpoint's
      // own per-task cache, and every project's Gantt cache (which project(s)
      // the two tasks belong to isn't known here), need invalidating too.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", relation.sourceTaskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", relation.targetTaskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useUpdateTaskRelation;
