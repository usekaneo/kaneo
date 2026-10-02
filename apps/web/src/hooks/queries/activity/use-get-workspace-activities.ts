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
    // Workspace pages have no project socket; refresh remote edits and activity
    // even when they do not produce a notification. Poll only while visible.
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetWorkspaceActivities;
