import { useQuery } from "@tanstack/react-query";
import getAgentConversations from "@/fetchers/agent/get-agent-conversations";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConversations(
  workspaceId: string,
  projectId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: agentQueryKeys.conversations(workspaceId, projectId),
    queryFn: () => getAgentConversations(workspaceId, projectId),
    enabled,
  });
}

export default useAgentConversations;
