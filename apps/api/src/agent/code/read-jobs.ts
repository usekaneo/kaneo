import { and, desc, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import {
  assertAgentProject,
  getOwnedRun,
  getVisibleRun,
  type AgentDatabase,
} from "../access";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { touchedProjectsReadable } from "../run-visibility";
import type { AgentSubject } from "../types";
import { publicJob } from "./job-response";
import { finishJob } from "./finish-job";
import { cancelGithubJob } from "./backends/github-actions";
import { notifyJob } from "./notify";

export async function visibleJob(
  subject: AgentSubject,
  jobId: string,
  owner = false,
  database: AgentDatabase = db,
) {
  const job = await database.query.agentJobTable.findFirst({
    where: and(
      eq(schema.agentJobTable.id, jobId),
      eq(schema.agentJobTable.workspaceId, subject.workspaceId),
    ),
  });
  if (!job) throw new HTTPException(404, { message: "Job not found" });
  await (owner ? getOwnedRun : getVisibleRun)(subject, job.runId, database);
  // Workspace-wide conversations can refer to restricted projects. Sharing a
  // conversation must never bypass the job's own project access boundary.
  await assertAgentProject(subject, job.projectId, database);
  return job;
}
export async function getCodeJob(subject: AgentSubject, jobId: string) {
  return db.transaction(
    async (tx) => publicJob(await visibleJob(subject, jobId, false, tx)),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function getJobEvents(
  subject: AgentSubject,
  jobId: string,
  after: number,
) {
  return db.transaction(
    async (tx) => {
      await visibleJob(subject, jobId, false, tx);
      return tx
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
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
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

export async function jobsForRuns(
  runIds: string[],
  subject: AgentSubject,
  database: AgentDatabase = db,
) {
  if (!runIds.length) return [];
  const conversation = schema.agentConversationTable;
  const run = schema.agentRunTable;
  const job = schema.agentJobTable;
  const jobs = await database
    .select({ job })
    .from(job)
    .innerJoin(run, eq(job.runId, run.id))
    .innerJoin(conversation, eq(run.conversationId, conversation.id))
    .innerJoin(schema.projectTable, eq(job.projectId, schema.projectTable.id))
    .where(
      and(
        inArray(job.runId, runIds),
        eq(job.workspaceId, subject.workspaceId),
        eq(conversation.workspaceId, subject.workspaceId),
        eq(schema.projectTable.workspaceId, subject.workspaceId),
        projectAccessCondition(subject.userId, job.projectId),
        or(
          isNull(conversation.projectId),
          projectAccessCondition(subject.userId, conversation.projectId),
        ),
        or(
          eq(conversation.userId, subject.userId),
          and(
            isNotNull(conversation.sharedAt),
            touchedProjectsReadable(subject),
          ),
        ),
      ),
    )
    .orderBy(desc(job.createdAt));
  return jobs.map(({ job }) => publicJob(job));
}
