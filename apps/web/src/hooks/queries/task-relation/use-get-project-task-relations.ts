import { useQuery } from "@tanstack/react-query";
import getProjectTaskRelations from "@/fetchers/task-relation/get-project-task-relations";

function useGetProjectTaskRelations(projectId: string) {
  return useQuery({
    queryKey: ["task-relations", "project", projectId],
    queryFn: () => getProjectTaskRelations(projectId),
    enabled: !!projectId,
    // The app disables refetchOnMount globally. Relations change while this
    // view is closed — a subtask added from a task detail panel, a cascade
    // from a delete — and an invalidation only marks an inactive query stale,
    // so without this the list would reopen on the edges it last saw.
    refetchOnMount: true,
  });
}

export default useGetProjectTaskRelations;
