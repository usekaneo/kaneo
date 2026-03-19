import { useQuery } from "@tanstack/react-query";
import getTaskRelations from "@/fetchers/task-relation/get-task-relations";

function useGetTaskRelations(taskId: string) {
  return useQuery({
    queryKey: ["task-relations", taskId],
    queryFn: () => getTaskRelations(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskRelations;
