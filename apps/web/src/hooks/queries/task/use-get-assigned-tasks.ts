import { useQuery } from "@tanstack/react-query";
import getAssignedTasks from "@/fetchers/task/get-assigned-tasks";

function useGetAssignedTasks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["assigned-tasks", workspaceId],
    queryFn: () => getAssignedTasks(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    // The app default skips refetching on mount; these lists go stale while
    // the user works elsewhere.
    refetchOnMount: "always",
  });
}

export default useGetAssignedTasks;
