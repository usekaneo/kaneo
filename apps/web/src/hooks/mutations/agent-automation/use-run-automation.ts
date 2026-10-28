import { useMutation, useQueryClient } from "@tanstack/react-query";
import fetcher from "@/fetchers/agent-automation/run-automation";
import { automationQueryKeys } from "@/hooks/queries/agent-automation/automation-query-keys";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

export default function useRunAutomation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (automationId: string) => fetcher(workspaceId, automationId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: automationQueryKeys.all(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: agentQueryKeys.all(workspaceId),
      });
    },
  });
}
