import getTasks from "@/fetchers/task/get-tasks";
import { useQuery } from "@tanstack/react-query";

function useGetTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId),
    refetchInterval: 5000,
    enabled: !!projectId,
  });
}

export default useGetTasks;
