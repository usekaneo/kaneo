import { and, eq } from "drizzle-orm";
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
      .set({ ...input, url, categories: [...new Set(input.categories)] })
      .where(eq(schema.instanceWebhookTable.id, id))
      .returning();
    if (!row) throw new HTTPException(404, { message: "Webhook not found" });
    if (!input.enabled) {
      await tx
        .update(schema.instanceWebhookDeliveryTable)
        .set({ state: "failed", errorCode: "disabled" })
        .where(
          and(
            eq(schema.instanceWebhookDeliveryTable.webhookId, id),
            eq(schema.instanceWebhookDeliveryTable.state, "pending"),
          ),
        );
    }
    if (!input.enabled) await pruneWebhookDeliveries(tx, id);
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
