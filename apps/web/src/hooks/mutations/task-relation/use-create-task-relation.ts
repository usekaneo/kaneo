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
      // The Gantt chart's dependency lines read a project-scoped cache
      // (["task-relations", "project", projectId]) that neither key above
      // reaches. Which project(s) the two tasks belong to isn't known here
      // (the create response carries only the relation, not the tasks), so
      // every project's cache is invalidated — a rare, cheap mutation, and
      // only mounted Gantt views actually refetch.
      queryClient.invalidateQueries({
        queryKey: ["task-relations", "project"],
      });
    },
  });
}

export default useCreateTaskRelation;
