import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { requireWebhook } from "./require-webhook";

export async function listWebhookDeliveries(id: string) {
  await requireWebhook(id);
  const rows = await db
    .select()
    .from(schema.instanceWebhookDeliveryTable)
    .where(eq(schema.instanceWebhookDeliveryTable.webhookId, id))
    .orderBy(
      desc(schema.instanceWebhookDeliveryTable.createdAt),
      desc(schema.instanceWebhookDeliveryTable.id),
    )
    .limit(20);
  return rows.map(({ payload, nextAttemptAt: _, webhookId: __, ...row }) => ({
    ...row,
    eventId: payload.id,
    action: payload.action,
    createdAt: row.createdAt.toISOString(),
  }));
}
