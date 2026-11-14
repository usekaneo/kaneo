import { useQuery } from "@tanstack/react-query";
import { getTangledOutcome } from "@/fetchers/tangled-integration/connection";

export function useTangledOutcome(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["tangled-outcome", projectId],
    queryFn: () => getTangledOutcome(projectId),
    enabled: Boolean(projectId) && enabled,
    refetchInterval: 30_000,
  });
}
