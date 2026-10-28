import type {
  AgentCodeProposal,
  AgentProposal,
  AgentRun,
  AgentRunResponse,
} from "@/types/agent";
export function splitAgentProposals(run: AgentRunResponse): AgentRun {
  return {
    ...run,
    proposals: run.proposals.filter(
      (proposal): proposal is AgentProposal =>
        proposal.action.type !== "code.run",
    ),
    codeProposals: run.proposals.filter(
      (proposal): proposal is AgentCodeProposal =>
        proposal.action.type === "code.run",
    ),
  };
}
