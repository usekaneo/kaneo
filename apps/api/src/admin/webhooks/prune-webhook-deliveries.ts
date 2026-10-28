import { sql } from "drizzle-orm";
import type { DbOrTx } from "../../project-access/db-or-tx";

export async function pruneWebhookDeliveries(
  database: DbOrTx,
  webhookId: string,
) {
  // Keep the newest 20 finished deliveries; queued jobs are never pruned.
  await database.execute(sql`
    DELETE FROM instance_webhook_delivery
    WHERE webhook_id = ${webhookId} AND state <> 'pending'
      AND id NOT IN (
        SELECT id FROM instance_webhook_delivery
        WHERE webhook_id = ${webhookId} AND state <> 'pending'
        ORDER BY created_at DESC, id DESC LIMIT 20
      )
  `);
}
