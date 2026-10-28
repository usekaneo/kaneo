import { useMutation, useQueryClient } from "@tanstack/react-query";
import startAgentCodeJob from "@/fetchers/agent/start-agent-code-job";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
import type { StartAgentCodeJobInput } from "@/types/agent";
export default function useStartAgentCodeJob(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartAgentCodeJobInput) =>
      startAgentCodeJob(workspaceId, input),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: agentQueryKeys.all(workspaceId),
      });
    },
  });
}
