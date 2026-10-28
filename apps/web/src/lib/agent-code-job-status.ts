import type { AgentCodeJob } from "@/types/agent";
export function isAgentCodeJobActive(status: AgentCodeJob["status"]) {
  return ["queued", "dispatched", "running", "committing"].includes(status);
}
