import type { AgentProposal } from "@/types/agent";

export type AgentProposalField = "title" | "assignee" | "dueDate" | "priority";

export type AgentProposalChange = {
  field: AgentProposalField;
  from: string | null;
  to: string | null;
};

export type AgentProposalSummary = {
  kind: "create" | "update";
  taskId: string | null;
  taskTitle: string;
  changes: AgentProposalChange[];
};

// Raw values only (user IDs, ISO dates, priority keys); the row component
// resolves names and formats them for display.
export function describeAgentProposal(
  proposal: AgentProposal,
): AgentProposalSummary {
  const { action } = proposal;
  if (action.type === "task.create") {
    const changes: AgentProposalChange[] = [];
    if (action.userId)
      changes.push({ field: "assignee", from: null, to: action.userId });
    if (action.dueDate)
      changes.push({ field: "dueDate", from: null, to: action.dueDate });
    if (action.priority && action.priority !== "no-priority")
      changes.push({ field: "priority", from: null, to: action.priority });
    return { kind: "create", taskId: null, taskTitle: action.title, changes };
  }

  const before = proposal.before;
  const { patch } = action;
  const changes: AgentProposalChange[] = [];
  if (patch.title !== undefined)
    changes.push({
      field: "title",
      from: before?.title ?? null,
      to: patch.title,
    });
  if (patch.userId !== undefined)
    changes.push({
      field: "assignee",
      from: before?.userId ?? null,
      to: patch.userId,
    });
  if (patch.dueDate !== undefined)
    changes.push({
      field: "dueDate",
      from: before?.dueDate ?? null,
      to: patch.dueDate,
    });
  if (patch.priority !== undefined)
    changes.push({
      field: "priority",
      from: before?.priority ?? null,
      to: patch.priority,
    });
  return {
    kind: "update",
    taskId: action.taskId,
    taskTitle: before?.title ?? "",
    changes,
  };
}
