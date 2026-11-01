import { useQuery } from "@tanstack/react-query";
import getAutomation from "@/fetchers/agent-automation/get-automation";
import { automationQueryKeys } from "./automation-query-keys";

export default function useAutomation(
  workspaceId: string,
  automationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: automationQueryKeys.detail(workspaceId, automationId),
    queryFn: () => getAutomation(workspaceId, automationId),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: 30000,
  });
}
