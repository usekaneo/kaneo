import { useMutation, useQueryClient } from "@tanstack/react-query";
import fetcher from "@/fetchers/agent-automation/take-over-automation";
import { automationQueryKeys } from "@/hooks/queries/agent-automation/automation-query-keys";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

export default function useTakeOverAutomation(workspaceId: string) {
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
