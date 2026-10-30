import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { pruneWebhookDeliveries } from "./prune-webhook-deliveries";
import { requireWebhook } from "./require-webhook";
import { publicWebhook } from "./public-webhook";
import type { WebhookInput } from "./schema";
import { validateWebhookUrl } from "./validate-webhook-url";

export async function updateWebhook(
  id: string,
  input: WebhookInput,
  audit: AdminAuditRequest,
) {
  const current = await requireWebhook(id);
  const url =
    !input.enabled && input.url === current.url
      ? current.url
      : await validateWebhookUrl(input.url);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.instanceWebhookTable)
      .set({
        ...input,
        url,
        categories: [...new Set(input.categories)],
        // Invalidate even uncommitted enqueues from the previous enabled period.
        cancelPendingBefore: sql`CASE WHEN NOT ${input.enabled} OR NOT ${schema.instanceWebhookTable.enabled}
          THEN (clock_timestamp() AT TIME ZONE 'utc')
          ELSE ${schema.instanceWebhookTable.cancelPendingBefore} END`,
      })
      .where(eq(schema.instanceWebhookTable.id, id))
      .returning();
    if (!row) throw new HTTPException(404, { message: "Webhook not found" });
    if (row.cancelPendingBefore) {
      await tx
        .update(schema.instanceWebhookDeliveryTable)
        .set({ state: "failed", errorCode: "disabled" })
        .where(
          and(
            eq(schema.instanceWebhookDeliveryTable.webhookId, id),
            eq(schema.instanceWebhookDeliveryTable.state, "pending"),
            sql`${schema.instanceWebhookDeliveryTable.createdAt} <= (
              SELECT cancel_pending_before FROM instance_webhook WHERE id = ${id}
            )`,
          ),
        );
      await pruneWebhookDeliveries(tx, id);
    }
    await recordAdminAction(
      {
        ...audit,
        action: "webhook.updated",
        targetType: "webhook",
        targetId: id,
      },
      tx,
    );
    return publicWebhook(row);
  });
}
