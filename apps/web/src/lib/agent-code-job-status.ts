import type { AgentCodeJob } from "@/types/agent";
export function isAgentCodeJobActive(status: AgentCodeJob["status"]) {
  return ["queued", "dispatched", "running", "committing"].includes(status);
}

// The API refuses cancels once committing starts, so a cancel never races the
// pull request Kaneo is creating.
export function canCancelAgentCodeJob(status: AgentCodeJob["status"]) {
  return ["queued", "dispatched", "running"].includes(status);
}
