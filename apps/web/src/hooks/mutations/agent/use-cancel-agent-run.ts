import { useMutation, useQueryClient } from "@tanstack/react-query";
import cancelAgentRun from "@/fetchers/agent/cancel-agent-run";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

function useCancelAgentRun(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => cancelAgentRun(workspaceId, runId),
    onSettled: (_data, _error, runId) => {
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.run(workspaceId, runId),
      });
    },
  });
}

export default useCancelAgentRun;
