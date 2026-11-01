import { useQuery } from "@tanstack/react-query";
import getAgentConfig from "@/fetchers/agent/get-agent-config";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: agentQueryKeys.config(workspaceId ?? ""),
    queryFn: () => getAgentConfig(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export default useAgentConfig;
