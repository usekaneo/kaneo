import { and, eq, isNull, sql } from "drizzle-orm";
import db from "../../database";
import { withQuillsSystemWorkspace } from "../../database/quills/client";
import { events } from "../../database/quills/schema/events";
import { workspaceUserTable, userTable } from "../../database/schema";
import { roleHasWorkspacePermission } from "../../utils/require-workspace-permission";
import { broadcastToUserAndWait } from "../../ws";
import {
  claimQuillsJob,
  enqueueQuillsEvent,
  finishQuillsJob,
  eventPayloadSchema,
} from "./queue";

export async function deliverQuillsChange(
  workspaceId: string,
  eventId: string,
) {
  const members = await db
    .select({
      userId: workspaceUserTable.userId,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        sql`coalesce(${userTable.banned},false)=false`,
      ),
    );
  for (const member of members)
    if (
      await roleHasWorkspacePermission(workspaceId, member.role, {
        workspace: ["read"],
        quills: ["read"],
      })
    ) {
      // Only invalidate caches: no feature data or credentials cross this channel.
      await broadcastToUserAndWait(member.userId, {
        type: "QUILLS_CHANGED",
        workspaceId,
        eventId,
      });
    }
}
export async function drainQuillsWorkspace(
  workspaceId: string,
  deliver = deliverQuillsChange,
) {
  await withQuillsSystemWorkspace(workspaceId, async (tx) => {
    const pending = await tx
      .select({ eventId: events.eventId })
      .from(events)
      .where(
        and(
          isNull(events.publishedAt),
          sql`NOT EXISTS (SELECT 1 FROM quills.job_queue j WHERE j.queue='quills.event' AND j.dedupe_key=${events.eventId})`,
        ),
      )
      .orderBy(events.id)
      .limit(100);
    for (const event of pending) await enqueueQuillsEvent(tx, event.eventId);
  });
  let processed = 0,
    failed = 0;
  const deadline = Date.now() + 10000;
  for (let i = 0; i < 10 && Date.now() < deadline; i++) {
    const job = await withQuillsSystemWorkspace(workspaceId, claimQuillsJob);
    if (!job) break;
    try {
      const payload = eventPayloadSchema.parse(job.payload);
      const event = await withQuillsSystemWorkspace(
        workspaceId,
        async (tx) =>
          (
            await tx
              .select({ id: events.id, publishedAt: events.publishedAt })
              .from(events)
              .where(eq(events.eventId, payload.eventId))
          )[0],
      );
      if (!event) throw new Error("Outbox event missing");
      if (!event.publishedAt) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            deliver(workspaceId, payload.eventId),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Broadcast timeout")),
                30000,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      await withQuillsSystemWorkspace(workspaceId, async (tx) => {
        await finishQuillsJob(tx, job.id, job.leaseToken!);
        await tx
          .update(events)
          .set({ publishedAt: new Date() })
          .where(eq(events.id, event.id));
      });
      processed++;
    } catch {
      failed++;
      try {
        await withQuillsSystemWorkspace(workspaceId, (tx) =>
          finishQuillsJob(
            tx,
            job.id,
            job.leaseToken!,
            "Quills event delivery failed",
          ),
        );
      } catch {
        /* A replacement worker owns an expired lease. */
      }
    }
  }
  return { processed, failed, degraded: failed > 0 };
}
let cursor = "";
export async function runQuillsJobs() {
  const page = await db.execute<{ workspaceId: string }>(
    sql`SELECT quills.runnable_workspaces(${cursor}) AS "workspaceId"`,
  );
  if (!page.rows.length) {
    cursor = "";
    return { degraded: false };
  }
  let degraded = false;
  const deadline = Date.now() + 10000;
  for (const row of page.rows) {
    if (Date.now() >= deadline) break;
    try {
      degraded =
        (await drainQuillsWorkspace(row.workspaceId)).degraded || degraded;
    } catch {
      degraded = true;
    }
    cursor = row.workspaceId;
  }
  return { degraded };
}
