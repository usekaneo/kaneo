import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import { and, eq, gt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { assertAgentAccess } from "../access";
import { readTask } from "../tools/read-tools";
import { checkChangeset } from "./changeset-policy";
import type { Changeset } from "./changeset-schema";
import { getCodeJobsConfig } from "./config";
import { notifyJob } from "./notify";
import { verifyGithubOidc } from "./verify-github-oidc";
import { finishJob } from "./finish-job";
import type { CodeJobError } from "./lifecycle";

const jobs = schema.agentJobTable;
export const hashCredential = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function claimJob(jobId: string, token: string) {
  const job = await db.query.agentJobTable.findFirst({
    where: eq(jobs.id, jobId),
  });
  if (
    !job ||
    !["queued", "dispatched"].includes(job.status) ||
    job.deadline.getTime() <= Date.now()
  )
    throw new HTTPException(410, { message: "Job is no longer claimable" });
  if (
    job.status === "queued" ||
    !job.externalRef ||
    !job.workflowRef ||
    !job.workflowSha ||
    !job.baseSha
  )
    throw new HTTPException(409, {
      message: "Dispatch is still being recorded",
    });
  const config = getCodeJobsConfig();
  if (!config)
    throw new HTTPException(503, { message: "Coding jobs unavailable" });
  try {
    await verifyGithubOidc(token, {
      audience: config.oidcAudience,
      repository: `${job.repositoryOwner}/${job.repositoryName}`,
      repositoryId: job.repositoryId,
      runId: job.externalRef,
      workflowRef: `${job.repositoryOwner}/${job.repositoryName}/.github/workflows/kaneo-agent.yml@refs/heads/${job.workflowRef}`,
      workflowSha: job.workflowSha,
    });
  } catch {
    throw new HTTPException(403, { message: "Invalid job identity" });
  }
  const subject = {
    userId: job.userId,
    workspaceId: job.workspaceId,
    projectId: job.projectId,
  };
  await assertAgentAccess(subject, {
    agent: ["run_code"],
    project: ["read"],
    task: ["read"],
  });
  if (!job.taskId)
    throw new HTTPException(410, { message: "Task no longer available" });
  const context = JSON.stringify(await readTask(subject, job.taskId)).slice(
    0,
    32000,
  );
  const credential = randomBytes(32).toString("base64url");
  const claimed = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(jobs)
      .set({
        status: "running",
        credentialHash: hashCredential(credential),
        startedAt: new Date(),
        heartbeatAt: new Date(),
        phase: "working",
      })
      .where(
        and(
          eq(jobs.id, jobId),
          eq(jobs.status, "dispatched"),
          gt(jobs.deadline, new Date()),
        ),
      )
      .returning();
    if (claimed)
      await tx
        .insert(schema.agentJobEventTable)
        .values({ jobId, phase: "running" });
    return claimed;
  });
  if (!claimed)
    throw new HTTPException(410, { message: "Job has already been claimed" });
  await notifyJob(claimed);
  // Only the claim receives instructions and a callback credential.
  return {
    credential,
    spec: {
      jobId,
      instructions: job.instructions,
      context,
      baseSha: job.baseSha,
      baseRef: job.baseRef!,
      branch: job.branch,
      repository: `${job.repositoryOwner}/${job.repositoryName}`,
      model: job.model,
      deadline: job.deadline.toISOString(),
    },
  };
}

export async function authenticateJob(jobId: string, token: string) {
  const job = await db.query.agentJobTable.findFirst({
    where: eq(jobs.id, jobId),
  });
  if (
    !job ||
    job.status !== "running" ||
    !job.credentialHash ||
    job.deadline.getTime() <= Date.now()
  )
    throw new HTTPException(410, { message: "Job is no longer active" });
  const actual = Buffer.from(hashCredential(token), "hex");
  const expected = Buffer.from(job.credentialHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new HTTPException(403, { message: "Invalid job credential" });
  return job;
}

export async function heartbeatJob(
  jobId: string,
  token: string,
  input: { phase?: "working" | "testing" | "collecting" },
) {
  const job = await authenticateJob(jobId, token);
  // Store coarse phases only. Model output and command lines may contain CI secrets.
  const now = new Date();
  const changed =
    input.phase &&
    input.phase !== job.phase &&
    (!job.heartbeatAt || now.getTime() - job.heartbeatAt.getTime() >= 2000);
  const [updated] = await db
    .update(jobs)
    .set({ heartbeatAt: now, ...(changed ? { phase: input.phase } : {}) })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "running"),
        eq(jobs.credentialHash, job.credentialHash!),
      ),
    )
    .returning();
  if (!updated)
    throw new HTTPException(410, { message: "Job is no longer active" });
  if (changed) await notifyJob(updated);
  return { cancelRequested: false };
}

export async function uploadChangeset(
  jobId: string,
  token: string,
  data: Changeset,
) {
  const job = await authenticateJob(jobId, token);
  if (data.outcome === "changes") {
    const result = checkChangeset(data, {
      baseSha: job.baseSha!,
      branch: job.branch,
      protectedRefs: [job.baseRef!, job.workflowRef!],
    });
    if (!result.ok)
      throw new HTTPException(400, {
        message: `Changeset rejected: ${result.violation}`,
      });
  }
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.id, jobId),
          eq(jobs.status, "running"),
          eq(jobs.credentialHash, job.credentialHash!),
          gt(jobs.deadline, new Date()),
        ),
      )
      .for("update");
    if (!locked)
      throw new HTTPException(410, {
        message: "Changeset already uploaded or job inactive",
      });
    if (data.outcome === "no_changes") {
      await finishJob(tx, job, {
        status: "completed",
        outcome: "no_changes",
        summary: data.summary,
      });
    } else {
      await tx
        .insert(schema.agentJobChangesetTable)
        .values({ jobId, data: gzipSync(JSON.stringify(data)) });
      await tx
        .insert(schema.agentJobEventTable)
        .values({ jobId, phase: "committing" });
      await tx
        .update(jobs)
        .set({
          status: "committing",
          phase: "opening_pr",
          credentialHash: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          attempts: 0,
        })
        .where(eq(jobs.id, jobId));
    }
  });
  await notifyJob(job);
  return { accepted: true as const };
}

export async function failJob(
  jobId: string,
  token: string,
  error: CodeJobError,
) {
  const job = await authenticateJob(jobId, token);
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.id, jobId),
          eq(jobs.status, "running"),
          eq(jobs.credentialHash, job.credentialHash!),
        ),
      )
      .for("update");
    if (!locked) throw new HTTPException(410, { message: "Job inactive" });
    await finishJob(tx, job, { status: "failed", error });
  });
  await notifyJob(job);
  return { accepted: true as const };
}
