import { and, asc, eq, lte, sql } from "drizzle-orm";
import db, { schema } from "../../database";

import { pruneWebhookDeliveries } from "./prune-webhook-deliveries";

export const MAX_WEBHOOK_ATTEMPTS = 3;

/** A short database lease keeps API instances from sending the same job. */
export async function claimWebhookDelivery() {
  const delivery = schema.instanceWebhookDeliveryTable;
  const webhook = schema.instanceWebhookTable;
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        delivery,
        url: webhook.url,
        signingSecret: webhook.signingSecret,
        enabled: webhook.enabled,
        current: sql<boolean>`${delivery.createdAt} > COALESCE(${webhook.cancelPendingBefore}, '-infinity'::timestamp)`,
      })
      .from(delivery)
      .innerJoin(webhook, eq(delivery.webhookId, webhook.id))
      .where(
        and(
          eq(delivery.state, "pending"),
          lte(
            delivery.nextAttemptAt,
            sql`(clock_timestamp() AT TIME ZONE 'utc')`,
          ),
        ),
      )
      .orderBy(asc(delivery.nextAttemptAt), asc(delivery.id))
      .limit(1)
      .for("update", { of: delivery, skipLocked: true });
    if (!job) return null;
    const errorCode =
      !job.enabled || !job.current
        ? "disabled"
        : job.delivery.attempts >= MAX_WEBHOOK_ATTEMPTS
          ? "interrupted"
          : null;
    if (errorCode) {
      await tx
        .update(delivery)
        .set({ state: "failed", errorCode })
        .where(eq(delivery.id, job.delivery.id));
      await pruneWebhookDeliveries(tx, job.delivery.webhookId);
      return null;
    }
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
