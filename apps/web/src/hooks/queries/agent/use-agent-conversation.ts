import { useQuery } from "@tanstack/react-query";
import getAgentConversation from "@/fetchers/agent/get-agent-conversation";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConversation(
  workspaceId: string,
  conversationId: string | undefined,
) {
  return useQuery({
    queryKey: agentQueryKeys.conversation(workspaceId, conversationId ?? ""),
    queryFn: () => getAgentConversation(workspaceId, conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
}

export default useAgentConversation;
