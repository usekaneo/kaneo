import { useQuery } from "@tanstack/react-query";
import getAgentConversationRuns from "@/fetchers/agent/get-agent-conversation-runs";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConversationRuns(
  workspaceId: string,
  conversationId: string | undefined,
) {
  return useQuery({
    queryKey: agentQueryKeys.conversationRuns(
      workspaceId,
      conversationId ?? "",
    ),
    queryFn: () => getAgentConversationRuns(workspaceId, conversationId ?? ""),
    enabled: Boolean(conversationId),
    // Newest first from the API; the thread reads top to bottom.
    select: (runs) => [...runs].reverse(),
  });
}

export default useAgentConversationRuns;
