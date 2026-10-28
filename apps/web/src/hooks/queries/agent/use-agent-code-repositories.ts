import { useQuery } from "@tanstack/react-query";
import getAgentCodeRepositories from "@/fetchers/agent/get-agent-code-repositories";
import { agentQueryKeys } from "./agent-query-keys";
export default function useAgentCodeRepositories(workspaceId: string) {
  return useQuery({
    queryKey: agentQueryKeys.codeRepositories(workspaceId),
    queryFn: () => getAgentCodeRepositories(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 30000,
  });
}
