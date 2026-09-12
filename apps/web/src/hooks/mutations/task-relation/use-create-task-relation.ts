import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";

function useCreateTaskRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskRelation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", variables.sourceTaskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", variables.targetTaskId],
      });
      // The list view reads relations per project rather than per task, and
      // the mutation does not carry the project the tasks belong to.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useCreateTaskRelation;
