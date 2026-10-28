import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getOwnedRun, getVisibleRun } from "../access";
import type { AgentSubject } from "../types";
import { publicJob } from "./job-response";
import { finishJob } from "./finish-job";
import { cancelGithubJob } from "./backends/github-actions";
import { notifyJob } from "./notify";

export async function visibleJob(
  subject: AgentSubject,
  jobId: string,
  owner = false,
) {
  const job = await db.query.agentJobTable.findFirst({
    where: and(
      eq(schema.agentJobTable.id, jobId),
      eq(schema.agentJobTable.workspaceId, subject.workspaceId),
    ),
  });
  if (!job) throw new HTTPException(404, { message: "Job not found" });
  await (owner ? getOwnedRun : getVisibleRun)(subject, job.runId);
  // Workspace-wide conversations can refer to restricted projects. Sharing a
  // conversation must never bypass the job's own project access boundary.
  const { assertAgentProject } = await import("../access");
  await assertAgentProject(subject, job.projectId);
  return job;
}
export async function getCodeJob(subject: AgentSubject, jobId: string) {
  return publicJob(await visibleJob(subject, jobId));
}
export async function getJobEvents(
  subject: AgentSubject,
  jobId: string,
  after: number,
) {
  await visibleJob(subject, jobId);
  return db
    .select()
    .from(schema.agentJobEventTable)
    .where(
      and(
        eq(schema.agentJobEventTable.jobId, jobId),
        gt(schema.agentJobEventTable.sequence, after),
      ),
    )
    .orderBy(schema.agentJobEventTable.sequence)
    .limit(100);
}
export async function cancelCodeJob(subject: AgentSubject, jobId: string) {
  const job = await visibleJob(subject, jobId, true);
  const cancelled = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.agentJobTable)
      .where(eq(schema.agentJobTable.id, job.id))
      .for("update");
    if (!current) throw new HTTPException(404, { message: "Job not found" });
    if (current.status === "committing")
      throw new HTTPException(409, {
        message: "Pull request creation has started",
      });
    if (["queued", "dispatched", "running"].includes(current.status)) {
      await finishJob(tx, current, { status: "cancelled" });
      return true;
    }
    return false;
  });
  if (cancelled) {
    await notifyJob(job);
    await cancelGithubJob(job).catch(() => {});
  }
  return getCodeJob(subject, jobId);
}

export async function jobsForRuns(runIds: string[], subject?: AgentSubject) {
  if (!runIds.length) return [];
  const jobs = await db
    .select()
    .from(schema.agentJobTable)
    .where(inArray(schema.agentJobTable.runId, runIds))
    .orderBy(desc(schema.agentJobTable.createdAt));
  if (!subject) return jobs.map(publicJob);
  const { assertAgentProject } = await import("../access");
  const visible = [];
  for (const job of jobs) {
    try {
      await assertAgentProject(subject, job.projectId);
      visible.push(publicJob(job));
    } catch (error) {
      if (!(error instanceof HTTPException) || error.status !== 404)
        throw error;
    }
  }
  return visible;
}
