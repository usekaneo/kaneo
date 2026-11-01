import { useMutation, useQueryClient } from "@tanstack/react-query";
import cancelAgentCodeJob from "@/fetchers/agent/cancel-agent-code-job";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
export default function useCancelAgentCodeJob(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelAgentCodeJob(workspaceId, jobId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: agentQueryKeys.all(workspaceId),
      });
    },
  });
}
