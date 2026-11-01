import { useQuery } from "@tanstack/react-query";
import getAgentCodeJobEvents from "@/fetchers/agent/get-agent-code-job-events";
import { agentQueryKeys } from "./agent-query-keys";
export default function useAgentCodeJobEvents(
  workspaceId: string,
  jobId: string | undefined,
  after = 0,
) {
  return useQuery({
    queryKey: agentQueryKeys.codeJobEvents(workspaceId, jobId ?? "", after),
    queryFn: () => getAgentCodeJobEvents(workspaceId, jobId ?? "", after),
    enabled: Boolean(workspaceId && jobId),
    refetchInterval: false,
  });
}
