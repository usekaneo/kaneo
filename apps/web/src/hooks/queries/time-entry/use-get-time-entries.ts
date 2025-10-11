import { useQuery } from "@tanstack/react-query";
import getTimeEntriesByTaskId from "@/fetchers/time-entry/get-time-entries";

function useGetTimeEntriesByTaskId(taskId: string) {
  return useQuery({
    queryKey: ["time-entries", taskId],
    queryFn: () => getTimeEntriesByTaskId(taskId),
    enabled: !!taskId,
  });
}

export default useGetTimeEntriesByTaskId;
