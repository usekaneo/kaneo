import type { AgentRunStatus } from "@/types/agent";

export function isAgentRunActive(status: AgentRunStatus) {
  return status === "queued" || status === "running";
}
