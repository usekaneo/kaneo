import type { QueryClient } from "@tanstack/react-query";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

// Job events contain IDs only; refetch authorized state rather than applying
// job data to a potentially shared or stale conversation cache.
export function invalidateAgentJobQueries(
  queryClient: QueryClient,
  workspaceId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: agentQueryKeys.all(workspaceId),
  });
}
