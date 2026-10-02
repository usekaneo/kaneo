import { useQuery } from "@tanstack/react-query";
import getWorkspaceActivities from "@/fetchers/activity/get-workspace-activities";

function useGetWorkspaceActivities(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-activity", workspaceId],
    queryFn: () => getWorkspaceActivities(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    // The app default skips refetching on mount; these lists go stale while
    // the user works elsewhere.
    refetchOnMount: "always",
  });
}

export default useGetWorkspaceActivities;
