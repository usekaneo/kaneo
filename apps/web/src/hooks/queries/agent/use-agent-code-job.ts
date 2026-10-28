import { useQuery } from "@tanstack/react-query";
import getAgentCodeJob from "@/fetchers/agent/get-agent-code-job";
import { agentQueryKeys } from "./agent-query-keys";
import { isAgentCodeJobActive } from "@/lib/agent-code-job-status";
export default function useAgentCodeJob(
  workspaceId: string,
  jobId: string | undefined,
) {
  return useQuery({
    queryKey: agentQueryKeys.codeJob(workspaceId, jobId ?? ""),
    queryFn: () => getAgentCodeJob(workspaceId, jobId ?? ""),
    enabled: Boolean(workspaceId && jobId),
    refetchInterval: (query) =>
      query.state.data && isAgentCodeJobActive(query.state.data.status)
        ? 5000
        : false,
  });
}
