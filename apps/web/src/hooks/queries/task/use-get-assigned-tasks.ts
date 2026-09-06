import { useQuery } from "@tanstack/react-query";
import getAssignedTasks from "@/fetchers/task/get-assigned-tasks";
import { isUnauthorizedError } from "@/lib/http-error";

export function useGetAssignedTasks() {
  return useQuery({
    queryKey: ["my-tasks"],
    queryFn: getAssignedTasks,
    // The client disables refetch-on-mount globally. Changes made elsewhere
    // only invalidate this query, so opening the page must fetch again.
    refetchOnMount: true,
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
  });
}
