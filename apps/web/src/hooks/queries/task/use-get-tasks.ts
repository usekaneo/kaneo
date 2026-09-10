import { useQuery } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId),
    // Inactive boards can miss child updates sent on their project socket.
    refetchOnMount: true,
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
    enabled: !!projectId,
  });
}
