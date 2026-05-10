import { useQuery } from "@tanstack/react-query";
import { getInstanceStatus } from "@/fetchers/instance/get-instance-status";

function useInstanceStatus() {
  return useQuery({
    queryKey: ["instance-status"],
    queryFn: getInstanceStatus,
    staleTime: 60_000,
  });
}

export default useInstanceStatus;
