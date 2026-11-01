import { publishEvent } from "../../events";
export async function notifyJob(job: {
  userId: string;
  workspaceId: string;
  runId: string;
  id: string;
}) {
  await publishEvent("agent.job_updated", {
    userId: job.userId,
    workspaceId: job.workspaceId,
    runId: job.runId,
    jobId: job.id,
  });
}
