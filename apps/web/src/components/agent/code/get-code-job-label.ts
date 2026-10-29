import type { AgentCodeJob } from "@/types/agent";

export type CodeJobTone = "active" | "success" | "danger" | "neutral";

type CodeJobLabel = {
  key: string;
  values?: { number: number };
  tone: CodeJobTone;
};

// One short label per job state, shared by the thread card and recent runs.
export function getCodeJobLabel(
  job: Pick<AgentCodeJob, "status" | "outcome" | "prNumber">,
): CodeJobLabel {
  switch (job.status) {
    case "completed":
      return job.outcome === "pr_opened" && job.prNumber !== null
        ? {
            key: "agent:code.status.prOpened",
            values: { number: job.prNumber },
            tone: "success",
          }
        : { key: "agent:code.status.noChanges", tone: "neutral" };
    case "failed":
      return { key: "agent:code.status.failed", tone: "danger" };
    case "cancelled":
      return { key: "agent:code.status.cancelled", tone: "neutral" };
    default:
      return { key: `agent:code.status.${job.status}`, tone: "active" };
  }
}
