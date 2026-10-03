import { useQuery } from "@tanstack/react-query";
import getAgentRun from "@/fetchers/agent/get-agent-run";
import { isAgentRunActive } from "@/lib/agent-run-status";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentRun(workspaceId: string, runId: string | undefined) {
  return useQuery({
    queryKey: agentQueryKeys.run(workspaceId, runId ?? ""),
    queryFn: () => getAgentRun(workspaceId, runId ?? ""),
    enabled: Boolean(runId),
    // AGENT_RUN_UPDATED on the user socket drives updates; polling only
    // covers a dropped socket while the run is still working.
    refetchInterval: (query) =>
      query.state.data && isAgentRunActive(query.state.data.status)
        ? 5_000
        : false,
  });
}

export default useAgentRun;
