import { useInfiniteQuery } from "@tanstack/react-query";
import getAgentConversations from "@/fetchers/agent/get-agent-conversations";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentConversations(
  workspaceId: string,
  projectId: string | undefined,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: agentQueryKeys.conversations(workspaceId, projectId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getAgentConversations(workspaceId, projectId, pageParam),
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.length === 20 && lastOffset < 10000
        ? lastOffset + 20
        : undefined,
    select: ({ pages }) => {
      const seen = new Set<string>();
      return pages.flat().filter((conversation) => {
        if (seen.has(conversation.id)) return false;
        seen.add(conversation.id);
        return true;
      });
    },
    enabled,
  });
}

export default useAgentConversations;
