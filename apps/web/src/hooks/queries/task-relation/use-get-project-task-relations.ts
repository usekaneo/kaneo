import { useQuery } from "@tanstack/react-query";
import getProjectTaskRelations from "@/fetchers/task-relation/get-project-task-relations";

function useGetProjectTaskRelations(projectId: string) {
  return useQuery({
    queryKey: ["task-relations", "project", projectId],
    queryFn: () => getProjectTaskRelations(projectId),
    enabled: !!projectId,
  });
}

export default useGetProjectTaskRelations;
