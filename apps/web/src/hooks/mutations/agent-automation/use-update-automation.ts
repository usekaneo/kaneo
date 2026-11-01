import { useMutation, useQueryClient } from "@tanstack/react-query";
import fetcher from "@/fetchers/agent-automation/update-automation";
import { automationQueryKeys } from "@/hooks/queries/agent-automation/automation-query-keys";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
import type { AutomationInput } from "@/types/agent-automation";

export default function useUpdateAutomation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      automationId,
      input,
    }: {
      automationId: string;
      input: AutomationInput;
    }) => fetcher(workspaceId, automationId, input),
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
