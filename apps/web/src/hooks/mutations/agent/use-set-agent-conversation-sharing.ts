import { useMutation, useQueryClient } from "@tanstack/react-query";
import { automationQueryKeys } from "@/hooks/queries/agent-automation/automation-query-keys";
import setAgentConversationSharing from "@/fetchers/agent/set-agent-conversation-sharing";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

function useSetAgentConversationSharing(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shared: boolean) =>
      setAgentConversationSharing(workspaceId, conversationId, shared),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: automationQueryKeys.all(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.conversation(workspaceId, conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.recentRuns(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: ["agent", workspaceId, "conversations"],
      });
    },
  });
}

export default useSetAgentConversationSharing;
