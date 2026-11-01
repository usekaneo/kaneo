import type { AgentProposalSummary } from "./describe-agent-proposal";

// i18n key under agent:proposal.action for a proposal's headline.
export function getProposalActionKey(summary: AgentProposalSummary) {
  if (summary.kind === "create") return "create";
  if (summary.kind === "comment") return "comment";
  const [change, ...rest] = summary.changes;
  if (!change || rest.length > 0) return "update";
  if (change.field === "assignee")
    return change.to ? (change.from ? "reassign" : "assign") : "unassign";
  if (change.field === "dueDate")
    return change.to
      ? change.from
        ? "moveDueDate"
        : "setDueDate"
      : "clearDueDate";
  if (change.field === "priority") return "priority";
  return "rename";
}
