import { useQuery } from "@tanstack/react-query";
import getRunningTimeEntry from "@/fetchers/time-entry/get-running-time-entry";

function useGetRunningTimeEntry() {
  return useQuery({
    queryKey: ["time-entries", "running", "me"],
    queryFn: () => getRunningTimeEntry(),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 30_000,
  });
}

export default useGetRunningTimeEntry;
