import { useQuery } from "@tanstack/react-query";
import getTimeEntriesByTaskId from "@/fetchers/time-entry/get-time-entries";

function useGetTimeEntriesByTaskId(taskId: string) {
  return useQuery({
    queryKey: ["time-entries", taskId],
    queryFn: () => getTimeEntriesByTaskId(taskId),
    enabled: !!taskId,
    // The app disables mount/focus revalidation globally; timer state goes
    // stale across tabs and remounts without these (stop elsewhere would
    // only heal on reload).
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export default useGetTimeEntriesByTaskId;
