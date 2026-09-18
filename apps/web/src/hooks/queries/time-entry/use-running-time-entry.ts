import { useQuery } from "@tanstack/react-query";
import getRunningTimeEntry from "@/fetchers/time-entry/get-running-time-entry";

function useRunningTimeEntry(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["time-entries", "running", workspaceId],
    queryFn: () => getRunningTimeEntry(workspaceId as string),
    enabled: !!workspaceId,
    // Picks up a timer started or stopped in another tab without realtime.
    refetchOnWindowFocus: true,
  });
}

export default useRunningTimeEntry;
