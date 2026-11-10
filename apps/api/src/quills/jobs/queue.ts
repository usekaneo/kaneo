import { randomUUID } from "node:crypto";
import { createId } from "@kaneo/ids";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../database/quills/client";
import { jobQueue } from "../../database/quills/schema/job-queue";

export const eventPayloadSchema = z
  .object({ eventId: z.string().min(1).max(200) })
  .strict();
export const LEASE_SECONDS = 300;
export async function enqueueQuillsEvent(db: Database, eventId: string) {
  const payload = eventPayloadSchema.parse({ eventId });
  const [row] = await db
    .insert(jobQueue)
    .values({
      jobId: createId("job"),
      queue: "quills.event",
      payload,
      dedupeKey: payload.eventId,
      maxAttempts: 3,
    })
    .onConflictDoNothing()
    .returning();
  return row;
}
export async function claimQuillsJob(db: Database) {
  await db.execute(
    sql`UPDATE quills.job_queue SET status=CASE WHEN attempts<max_attempts THEN 'pending' ELSE 'failed' END,run_at=now(),finished_at=CASE WHEN attempts>=max_attempts THEN now() ELSE NULL END,lease_token=NULL,locked_until=NULL,locked_by=NULL,last_error='Worker lease expired',updated_at=now() WHERE queue='quills.event' AND status='running' AND locked_until<=now()`,
  );
  const [job] = await db
    .select()
    .from(jobQueue)
    .where(
      sql`${jobQueue.queue}='quills.event' AND ${jobQueue.status}='pending' AND ${jobQueue.runAt}<=now()`,
    )
    .orderBy(jobQueue.runAt, jobQueue.id)
    .for("update", { skipLocked: true })
    .limit(1);
  if (!job) return;
  const token = randomUUID();
  const [claimed] = await db
    .update(jobQueue)
    .set({
      status: "running",
      attempts: job.attempts + 1,
      leaseToken: token,
      lockedUntil: sql`now()+${LEASE_SECONDS}*interval '1 second'`,
      lockedBy: `api:${process.pid}`,
      startedAt: new Date(),
      updatedAt: new Date(),
      finishedAt: null,
    })
    .where(eq(jobQueue.id, job.id))
    .returning();
  return claimed;
}
export async function finishQuillsJob(
  db: Database,
  jobId: bigint,
  leaseToken: string,
  error?: string,
) {
  const [job] = await db
    .select()
    .from(jobQueue)
    .where(
      and(
        eq(jobQueue.id, jobId),
        eq(jobQueue.leaseToken, leaseToken),
        sql`${jobQueue.status}='running' AND ${jobQueue.lockedUntil}>now()`,
      ),
    )
    .for("update");
  if (!job) throw new Error("Quills job lease lost");
  const retry = Boolean(error && job.attempts < job.maxAttempts);
  await db
    .update(jobQueue)
    .set({
      status: retry ? "pending" : error ? "failed" : "succeeded",
      lastError: error ?? null,
      runAt: sql`now()+${Math.min(3600, 2 ** job.attempts * 10)}*interval '1 second'`,
      finishedAt: retry ? null : new Date(),
      leaseToken: null,
      lockedUntil: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(jobQueue.id, jobId));
}
