import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

export function invalidateAgentConversationRuns(
  client: QueryClient,
  workspaceId: string,
  conversationId: string,
  runId: string,
) {
  const queryKey = agentQueryKeys.conversationRuns(workspaceId, conversationId);
  const history =
    client.getQueryData<InfiniteData<Array<{ id: string }>>>(queryKey);
  // Details refresh separately while streaming. Reload history only when a
  // new run arrives from another tab/device, without polling every old page.
  if (history?.pages.some((page) => page.some((run) => run.id === runId)))
    return;
  return client.invalidateQueries({ queryKey });
}
