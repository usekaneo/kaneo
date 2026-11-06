import { queryOptions, useQuery } from "@tanstack/react-query";
import { getInstanceStatus } from "@/fetchers/instance/get-instance-status";

export function instanceStatusQueryOptions() {
  return queryOptions({
    queryKey: ["instance-status"],
    queryFn: getInstanceStatus,
    staleTime: 60_000,
  });
}

function useInstanceStatus() {
  return useQuery(instanceStatusQueryOptions());
}

export default useInstanceStatus;
