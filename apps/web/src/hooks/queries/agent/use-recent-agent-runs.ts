import { isAgentCodeJobActive } from "@/lib/agent-code-job-status";
import { useQuery } from "@tanstack/react-query";
import getRecentAgentRuns from "@/fetchers/agent/get-recent-agent-runs";
import { agentQueryKeys } from "./agent-query-keys";

function useRecentAgentRuns(workspaceId: string) {
  return useQuery({
    queryKey: agentQueryKeys.recentRuns(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.some((run) =>
        run.jobs.some((job) => isAgentCodeJobActive(job.status)),
      )
        ? 5000
        : false,
    queryFn: () => getRecentAgentRuns(workspaceId),
  });
}

export default useRecentAgentRuns;
