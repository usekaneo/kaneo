import { useQuery } from "@tanstack/react-query";
import getAgentConversationRuns from "@/fetchers/agent/get-agent-conversation-runs";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConversationRuns(
  workspaceId: string,
  conversationId: string | undefined,
  // Shared viewers get no AGENT_RUN_UPDATED messages, so they poll for the
  // owner's new runs; active runs already poll in useAgentRun.
  watch = false,
) {
  return useQuery({
    queryKey: agentQueryKeys.conversationRuns(
      workspaceId,
      conversationId ?? "",
    ),
    queryFn: () => getAgentConversationRuns(workspaceId, conversationId ?? ""),
    enabled: Boolean(conversationId),
    refetchInterval: watch ? 30_000 : false,
    // Newest first from the API; the thread reads top to bottom.
    select: (runs) => [...runs].reverse(),
  });
}

export default useAgentConversationRuns;
