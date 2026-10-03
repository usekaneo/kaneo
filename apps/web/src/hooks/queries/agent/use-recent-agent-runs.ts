import { useQuery } from "@tanstack/react-query";
import getRecentAgentRuns from "@/fetchers/agent/get-recent-agent-runs";
import { agentQueryKeys } from "./agent-query-keys";

function useRecentAgentRuns(workspaceId: string) {
  return useQuery({
    queryKey: agentQueryKeys.recentRuns(workspaceId),
    queryFn: () => getRecentAgentRuns(workspaceId),
  });
}

export default useRecentAgentRuns;
