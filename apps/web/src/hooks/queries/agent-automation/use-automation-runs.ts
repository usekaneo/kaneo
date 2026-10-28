import { useQuery } from "@tanstack/react-query";
import getAutomationRuns from "@/fetchers/agent-automation/get-automation-runs";
import { automationQueryKeys } from "./automation-query-keys";

export default function useAutomationRuns(
  workspaceId: string,
  automationId: string,
  query: { limit?: string; offset?: string } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: automationQueryKeys.runs(workspaceId, automationId, query),
    queryFn: () => getAutomationRuns(workspaceId, automationId, query),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: 30000,
  });
}
