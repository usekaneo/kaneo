import { useQuery } from "@tanstack/react-query";
import getAgentCodeStatus from "@/fetchers/agent/get-agent-code-status";
import { agentQueryKeys } from "./agent-query-keys";
export default function useAgentCodeStatus(workspaceId: string) {
  return useQuery({
    queryKey: agentQueryKeys.codeStatus(workspaceId),
    queryFn: () => getAgentCodeStatus(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 30000,
  });
}
