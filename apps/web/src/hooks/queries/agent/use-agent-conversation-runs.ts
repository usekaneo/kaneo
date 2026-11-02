import { useInfiniteQuery } from "@tanstack/react-query";
import getAgentConversationRuns from "@/fetchers/agent/get-agent-conversation-runs";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConversationRuns(
  workspaceId: string,
  conversationId: string | undefined,
  // Shared viewers get no AGENT_RUN_UPDATED messages, so they poll for the
  // owner's new runs; active runs already poll in useAgentRun.
  watch = false,
) {
  return useInfiniteQuery({
    queryKey: agentQueryKeys.conversationRuns(
      workspaceId,
      conversationId ?? "",
    ),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getAgentConversationRuns(workspaceId, conversationId ?? "", pageParam),
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.length === 10 && lastOffset < 10000
        ? lastOffset + 10
        : undefined,
    enabled: Boolean(conversationId),
    refetchInterval: watch ? 30_000 : false,
    // Newest first from the API; the thread reads top to bottom.
    // New runs can arrive between offset pages. Keep each run only once.
    select: ({ pages }) => {
      const seen = new Set<string>();
      return pages
        .flat()
        .filter((run) => {
          if (seen.has(run.id)) return false;
          seen.add(run.id);
          return true;
        })
        .reverse();
    },
  });
}

export default useAgentConversationRuns;
