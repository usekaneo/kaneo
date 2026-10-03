import { useMutation, useQueryClient } from "@tanstack/react-query";
import applyAgentProposals from "@/fetchers/agent/apply-agent-proposals";
import discardAgentProposals from "@/fetchers/agent/discard-agent-proposals";
import undoAgentProposal from "@/fetchers/agent/undo-agent-proposal";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";

// Apply, discard, and undo all change proposal state on one run; refetch it
// whatever the outcome so selections never act on stale statuses.
function useReviewAgentProposals(workspaceId: string, runId: string) {
  const queryClient = useQueryClient();
  const onSettled = () => {
    queryClient.invalidateQueries({
      queryKey: agentQueryKeys.run(workspaceId, runId),
    });
    queryClient.invalidateQueries({
      queryKey: agentQueryKeys.recentRuns(workspaceId),
    });
  };

  const apply = useMutation({
    mutationFn: (proposalIds: string[]) =>
      applyAgentProposals(workspaceId, runId, proposalIds),
    onSettled,
  });
  const discard = useMutation({
    mutationFn: (proposalIds: string[]) =>
      discardAgentProposals(workspaceId, runId, proposalIds),
    onSettled,
  });
  const undo = useMutation({
    mutationFn: (proposalId: string) =>
      undoAgentProposal(workspaceId, proposalId),
    onSettled,
  });

  return { apply, discard, undo };
}

export default useReviewAgentProposals;
