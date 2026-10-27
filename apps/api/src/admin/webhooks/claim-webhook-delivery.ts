import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import db, { schema } from "../../database";

import { pruneWebhookDeliveries } from "./prune-webhook-deliveries";

export const MAX_WEBHOOK_ATTEMPTS = 3;

/** A short database lease keeps API instances from sending the same job. */
export async function claimWebhookDelivery() {
  const delivery = schema.instanceWebhookDeliveryTable;
  const webhook = schema.instanceWebhookTable;
  // A process may have stopped during its final attempt.
  const interrupted = await db
    .update(delivery)
    .set({ state: "failed", errorCode: "interrupted" })
    .where(
      and(
        eq(delivery.state, "pending"),
        gte(delivery.attempts, MAX_WEBHOOK_ATTEMPTS),
        lte(
          delivery.nextAttemptAt,
          sql`(clock_timestamp() AT TIME ZONE 'utc')`,
        ),
      ),
    )
    .returning({ webhookId: delivery.webhookId });
  for (const id of new Set(interrupted.map((job) => job.webhookId))) {
    await pruneWebhookDeliveries(db, id);
  }
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        delivery,
        url: webhook.url,
        signingSecret: webhook.signingSecret,
      })
      .from(delivery)
      .innerJoin(webhook, eq(delivery.webhookId, webhook.id))
      .where(
        and(
          eq(delivery.state, "pending"),
          lt(delivery.attempts, MAX_WEBHOOK_ATTEMPTS),
          lte(
            delivery.nextAttemptAt,
            sql`(clock_timestamp() AT TIME ZONE 'utc')`,
          ),
          eq(webhook.enabled, true),
        ),
      )
      .orderBy(asc(delivery.nextAttemptAt), asc(delivery.id))
      .limit(1)
      .for("update", { of: delivery, skipLocked: true });
    if (!job) return null;
    const attempts = job.delivery.attempts + 1;
    await tx
      .update(delivery)
      .set({
        attempts,
        nextAttemptAt: sql`(clock_timestamp() AT TIME ZONE 'utc') + interval '1 minute'`,
      })
      .where(eq(delivery.id, job.delivery.id));
    return { ...job, delivery: { ...job.delivery, attempts } };
  });
}
