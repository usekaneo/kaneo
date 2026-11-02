import { isAgentCodeJobActive } from "@/lib/agent-code-job-status";
import { useQuery } from "@tanstack/react-query";
import getAgentRun from "@/fetchers/agent/get-agent-run";
import { isAgentRunActive } from "@/lib/agent-run-status";
import { agentQueryKeys } from "./agent-query-keys";

function useAgentRun(
  workspaceId: string,
  runId: string | undefined,
  watch = false,
) {
  return useQuery({
    queryKey: agentQueryKeys.run(workspaceId, runId ?? ""),
    queryFn: () => getAgentRun(workspaceId, runId ?? ""),
    enabled: Boolean(runId),
    // Shared viewers receive no owner socket events. Keep review/undo state
    // current for them after execution finishes, too.
    refetchInterval: (query) =>
      query.state.data &&
      (isAgentRunActive(query.state.data.status) ||
        query.state.data.jobs.some((job) => isAgentCodeJobActive(job.status)))
        ? 5_000
        : watch
          ? 30_000
          : false,
  });
}

export default useAgentRun;
