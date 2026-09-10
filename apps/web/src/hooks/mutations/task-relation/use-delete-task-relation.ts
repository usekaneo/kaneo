import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

import { invalidateRelationTaskProject } from "./invalidate-relation-task-project";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: (relation) => {
      void invalidateRelationTaskProject(queryClient, relation.sourceTaskId);
      queryClient.invalidateQueries({
        queryKey: ["task-relations", taskId],
      });
    },
  });
}

export default useDeleteTaskRelation;
