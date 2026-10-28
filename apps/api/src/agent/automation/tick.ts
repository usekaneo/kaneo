import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import { withJobLease } from "../../scheduler/leader-lock";
import { collectAutomationDueDates } from "./check-due-dates";
import {
  AUTOMATION_BATCH_EVENT_LIMIT,
  AUTOMATION_BATCH_WINDOW_MS,
  isBatchReady,
} from "./limits";
import { checkOwnerAccess } from "./owner-access";
import { pauseAutomation, recordSkip } from "./pause";
import { queueAutomationRun } from "./queue-run";
import { followingRun } from "./schedule";

function requestId(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function tickAutomations(now = new Date()) {
  return withJobLease(
    "agent-automations",
    async () => {
      const a = schema.agentAutomationTable;
      const rows = await db
        .select({ id: a.id })
        .from(a)
        .where(
          and(
            eq(a.enabled, true),
            or(lte(a.nextRunAt, now), sql`${a.eventType} IS NOT NULL`),
          ),
        )
        .orderBy(a.nextRunAt, a.id);
      let degraded = false;
      for (const { id } of rows) {
        try {
          await db.transaction(async (tx) => {
            const [row] = await tx
              .select()
              .from(a)
              .where(eq(a.id, id))
              .for("update", { skipLocked: true });
            if (!row?.enabled) return;
            const access = await checkOwnerAccess(row);
            if (access === "lost") {
              await pauseAutomation(tx, id, "owner_access");
              return;
            }
            if (access !== "ok") {
              await recordSkip(tx, id, "unavailable");
              return;
            }
            if (
              row.trigger.type === "schedule" &&
              row.nextRunAt &&
              row.nextRunAt <= now
            ) {
              const slot = row.nextRunAt;
              const result = await queueAutomationRun(
                tx,
                row,
                {
                  source: "schedule",
                  scheduledFor: slot.toISOString(),
                  events: [],
                  moreEvents: 0,
                },
                requestId(`${id}:${slot.toISOString()}`),
                now,
              );
              if (!result.queued) await recordSkip(tx, id, result.reason);
              else
                await tx
                  .update(a)
                  .set({ lastSkipReason: null, lastSkippedAt: null })
                  .where(eq(a.id, id));
              await tx
                .update(a)
                .set({ nextRunAt: followingRun(row.trigger, slot, now) })
                .where(eq(a.id, id));
            } else if (row.trigger.type === "event") {
              if (row.trigger.event === "due_date_passed")
                await collectAutomationDueDates(tx, row, now);
              const events = await tx
                .select()
                .from(schema.agentAutomationEventTable)
                .where(
                  and(
                    eq(schema.agentAutomationEventTable.automationId, id),
                    isNull(schema.agentAutomationEventTable.consumedAt),
                  ),
                )
                .orderBy(
                  schema.agentAutomationEventTable.createdAt,
                  schema.agentAutomationEventTable.id,
                )
                .limit(200);
              if (!events.length || !isBatchReady(events[0]!.createdAt, now))
                return;
              const batch = events.filter(
                (event) =>
                  event.createdAt.getTime() <
                  events[0]!.createdAt.getTime() + AUTOMATION_BATCH_WINDOW_MS,
              );
              const result = await queueAutomationRun(
                tx,
                row,
                {
                  source: "event",
                  scheduledFor: null,
                  events: batch
                    .slice(0, AUTOMATION_BATCH_EVENT_LIMIT)
                    .map((event) => event.payload!),
                  moreEvents: Math.max(
                    0,
                    batch.length - AUTOMATION_BATCH_EVENT_LIMIT,
                  ),
                },
                requestId(`${id}:${events[0]!.id}`),
                now,
                batch.map((event) => event.payload!.projectId),
              );
              if (!result.queued) await recordSkip(tx, id, result.reason);
              else
                await tx
                  .update(a)
                  .set({ lastSkipReason: null, lastSkippedAt: null })
                  .where(eq(a.id, id));
              // Overlapping runs keep the batch for the next tick. Caps skip it.
              if (result.queued || result.reason !== "overlap")
                await tx
                  .update(schema.agentAutomationEventTable)
                  .set({ consumedAt: now, payload: null })
                  .where(
                    and(
                      inArray(
                        schema.agentAutomationEventTable.id,
                        batch.map((event) => event.id),
                      ),
                      isNull(schema.agentAutomationEventTable.consumedAt),
                    ),
                  );
            }
          });
        } catch {
          degraded = true;
          console.error("Automation tick failed", { automationId: id });
        }
      }
      return { degraded };
    },
    () => ({ degraded: false }),
  );
}
