import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { withoutOutboundTelemetry } from "../../utils/sensitive-outbound";
import { codeRepository } from "./repository";
import {
  dispatchGithubJob,
  cancelGithubJob,
  observeGithubJob,
} from "./backends/github-actions";
import { commitGithubChangeset } from "./commit-github";
import { finishJob, type CodeJob } from "./finish-job";
import { notifyJob } from "./notify";
import { CODE_JOB_ERRORS, type CodeJobError } from "./lifecycle";

const jobs = schema.agentJobTable;
let processing = false;

async function fail(job: CodeJob, error: CodeJobError, owner: string) {
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.id, job.id),
          eq(jobs.leaseOwner, owner),
          inArray(jobs.status, [
            "queued",
            "dispatched",
            "running",
            "committing",
          ]),
        ),
      )
      .for("update");
    if (locked) await finishJob(tx, locked, { status: "failed", error });
  });
  await notifyJob(job);
  await cancelGithubJob(job).catch(() => {});
}

async function executeJob(job: CodeJob, owner: string, signal: AbortSignal) {
  try {
    signal.throwIfAborted();
    if (job.status === "queued") {
      if (!job.taskId || !job.integrationId)
        throw new HTTPException(403, { message: "access_revoked" });
      const { repository } = await codeRepository(
        {
          userId: job.userId,
          workspaceId: job.workspaceId,
          projectId: job.projectId,
        },
        job.taskId,
        job.integrationId,
        db,
        true,
      );
      if (repository.id !== job.repositoryId)
        throw new HTTPException(403, { message: "access_revoked" });
      const dispatched = await dispatchGithubJob(job, signal);
      const updated = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(jobs)
          .set({
            ...dispatched,
            status: "dispatched",
            dispatchedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            phase: "starting",
            attempts: 0,
          })
          .where(
            and(
              eq(jobs.id, job.id),
              eq(jobs.status, "queued"),
              eq(jobs.leaseOwner, owner),
            ),
          )
          .returning();
        if (updated)
          await tx
            .insert(schema.agentJobEventTable)
            .values({ jobId: job.id, phase: "dispatched" });
        return updated;
      });
      if (!updated)
        await cancelGithubJob({ ...job, ...dispatched }).catch(() => {});
      else await notifyJob(updated);
    } else if (job.status === "committing") {
      const result = await commitGithubChangeset(job, signal);
      await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.id, job.id),
              eq(jobs.status, "committing"),
              eq(jobs.leaseOwner, owner),
            ),
          )
          .for("update");
        if (locked)
          await finishJob(tx, job, { ...result, status: "completed" });
      });
      await notifyJob(job);
    } else {
      const stale =
        job.status === "dispatched"
          ? (job.dispatchedAt?.getTime() ?? job.createdAt.getTime()) <
            Date.now() - 600000
          : (job.heartbeatAt?.getTime() ?? 0) < Date.now() - 300000;
      if (job.deadline.getTime() <= Date.now() || stale) {
        await fail(
          job,
          job.status === "dispatched" ? "claim_timeout" : "timed_out",
          owner,
        );
      } else if ((await observeGithubJob(job)) === "gone") {
        await fail(job, "ci_run_failed", owner);
      } else {
        await db
          .update(jobs)
          .set({
            leaseOwner: null,
            leaseExpiresAt: new Date(Date.now() + 60000),
          })
          .where(and(eq(jobs.id, job.id), eq(jobs.leaseOwner, owner)));
      }
    }
  } catch (error) {
    // Store stable codes only; Octokit errors can contain credentials and bodies.
    const code: CodeJobError =
      error instanceof HTTPException &&
      CODE_JOB_ERRORS.includes(error.message as CodeJobError)
        ? (error.message as CodeJobError)
        : error instanceof HTTPException &&
            [402, 403, 404].includes(error.status)
          ? "access_revoked"
          : job.status === "queued"
            ? "dispatch_failed"
            : "commit_failed";
    if (job.attempts >= 3 || error instanceof HTTPException)
      await fail(job, code, owner);
    else
      await db
        .update(jobs)
        .set({
          leaseOwner: null,
          leaseExpiresAt: new Date(Date.now() + 30000 * job.attempts),
        })
        .where(and(eq(jobs.id, job.id), eq(jobs.leaseOwner, owner)));
  }
}

export async function processCodeJobs(
  signal: AbortSignal = new AbortController().signal,
) {
  if (processing || signal.aborted) return;
  processing = true;
  try {
    const pending: Promise<void>[] = [];
    // At most two short host operations per tick. Leases coordinate API replicas.
    for (let index = 0; index < 2 && !signal.aborted; index++) {
      const owner = randomUUID();
      const job = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(jobs)
          .where(
            and(
              inArray(jobs.status, [
                "queued",
                "dispatched",
                "running",
                "committing",
              ]),
              or(
                isNull(jobs.leaseExpiresAt),
                lt(jobs.leaseExpiresAt, new Date()),
              ),
            ),
          )
          .orderBy(jobs.createdAt, jobs.id)
          .limit(1)
          .for("update", { skipLocked: true });
        if (!job) return null;
        const [leased] = await tx
          .update(jobs)
          .set({
            leaseOwner: owner,
            leaseExpiresAt: new Date(Date.now() + 300000),
            attempts: job.attempts + 1,
          })
          .where(eq(jobs.id, job.id))
          .returning();
        return leased;
      });
      if (!job) break;
      const boundedSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(120000),
      ]);
      pending.push(
        withoutOutboundTelemetry(async () => {
          if (
            job.deadline.getTime() <= Date.now() &&
            job.status !== "committing"
          )
            await fail(job, "timed_out", owner);
          else await executeJob(job, owner, boundedSignal);
        }),
      );
    }
    await Promise.all(pending);
  } finally {
    processing = false;
  }
}
