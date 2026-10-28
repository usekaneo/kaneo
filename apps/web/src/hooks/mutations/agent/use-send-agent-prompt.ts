import { useMutation, useQueryClient } from "@tanstack/react-query";
import createAgentConversation from "@/fetchers/agent/create-agent-conversation";
import createAgentRun from "@/fetchers/agent/create-agent-run";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
import { useAgentModel } from "@/hooks/use-agent-model";

type SendAgentPromptInput = {
  conversationId?: string;
  prompt: string;
  attachments: Array<{ name: string; content: string }>;
};

function useSendAgentPrompt(workspaceId: string, projectId?: string) {
  const queryClient = useQueryClient();
  const { model } = useAgentModel(workspaceId);

  return useMutation({
    mutationFn: async ({
      conversationId,
      prompt,
      attachments,
    }: SendAgentPromptInput) => {
      const targetId =
        conversationId ??
        (
          await createAgentConversation(workspaceId, {
            title: prompt.slice(0, 120),
            ...(projectId ? { projectId } : {}),
          })
        ).id;
      const run = await createAgentRun(workspaceId, targetId, {
        requestId: crypto.randomUUID(),
        prompt,
        attachments,
        ...(model ? { model } : {}),
      });
      return { conversationId: targetId, runId: run.id };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.conversationRuns(workspaceId, conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: [...agentQueryKeys.all(workspaceId), "conversations"],
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.recentRuns(workspaceId),
      });
    },
  });
}

export default useSendAgentPrompt;
