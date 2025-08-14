import getTaskLinks from "@/fetchers/task-link/get-task-links";
import { useQuery } from "@tanstack/react-query";

function useGetTaskLinks(taskId: string) {
  return useQuery({
    queryKey: ["task-links", taskId],
    queryFn: () => getTaskLinks(taskId),
    enabled: !!taskId,
  });
}

export default useGetTaskLinks;
