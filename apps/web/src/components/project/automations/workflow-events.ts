export const WORKFLOW_EVENTS = [
  "branch_push",
  "pr_opened",
  "pr_merged",
  "issue_opened",
  "issue_closed",
] as const;

export type WorkflowEvent = (typeof WORKFLOW_EVENTS)[number];
