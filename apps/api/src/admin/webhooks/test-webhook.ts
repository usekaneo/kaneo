import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";

export async function testWebhook(id: string, audit: AdminAuditRequest) {
  return db.transaction(async (tx) => {
    const [webhook] = await tx
      .select()
      .from(schema.instanceWebhookTable)
      .where(eq(schema.instanceWebhookTable.id, id))
      .for("share");
    if (!webhook)
      throw new HTTPException(404, { message: "Webhook not found" });
    if (!webhook.enabled)
      throw new HTTPException(409, {
        message: "Enable the webhook before sending a test.",
      });
    const [row] = await tx
      .insert(schema.instanceWebhookDeliveryTable)
      .values({
        webhookId: id,
        payload: {
          id: createId(),
          action: "webhook.test",
          actorUserId: audit.actorUserId,
          actorName: null,
          actorEmail: null,
          targetType: "webhook",
          targetId: id,
          targetLabel: null,
          metadata: null,
          ipAddress: null,
          createdAt: new Date().toISOString(),
        },
      })
      .returning({ id: schema.instanceWebhookDeliveryTable.id });
    return row!;
  });
}
