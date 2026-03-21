import { useQuery } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export function useGetTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId),
    refetchInterval: 30000,
    enabled: !!projectId,
  });
}
