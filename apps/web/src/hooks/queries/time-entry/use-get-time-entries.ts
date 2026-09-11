import { useQuery } from "@tanstack/react-query";
import getTimeEntriesByTaskId from "@/fetchers/time-entry/get-time-entries";

function useGetTimeEntriesByTaskId(taskId: string) {
  return useQuery({
    queryKey: ["time-entries", taskId],
    queryFn: () => getTimeEntriesByTaskId(taskId),
    enabled: !!taskId,
    // Task-detail data is refetched on mount (see use-get-task) so reopening a
    // task shows entries others logged since; the global client disables this.
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useGetTimeEntriesByTaskId;
