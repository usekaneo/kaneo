import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";

import { invalidateRelationTaskProject } from "./invalidate-relation-task-project";

function useCreateTaskRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskRelation,
    onSuccess: (_, variables) => {
      void invalidateRelationTaskProject(queryClient, variables.sourceTaskId);
      // Queries default to refetchOnMount: false, so a closed but cached end
      // must refetch now or reopening it shows the old relations.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", variables.sourceTaskId],
        refetchType: "all",
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", variables.targetTaskId],
        refetchType: "all",
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
