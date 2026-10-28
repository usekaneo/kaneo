import { useQuery } from "@tanstack/react-query";
import getAutomations from "@/fetchers/agent-automation/get-automations";
import { automationQueryKeys } from "./automation-query-keys";
import type { AutomationListQuery } from "@/types/agent-automation";

export default function useAutomations(
  workspaceId: string,
  query: AutomationListQuery = {},
  enabled = true,
) {
  return useQuery({
    queryKey: automationQueryKeys.list(workspaceId, query),
    queryFn: () => getAutomations(workspaceId, query),
    enabled: enabled && Boolean(workspaceId),
    refetchInterval: 30000,
  });
}
