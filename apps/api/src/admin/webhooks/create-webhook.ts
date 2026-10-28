import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { newSigningSecret } from "./new-signing-secret";
import { publicWebhook } from "./public-webhook";
import type { WebhookInput } from "./schema";
import { validateWebhookUrl } from "./validate-webhook-url";

export async function createWebhook(
  input: WebhookInput,
  audit: AdminAuditRequest,
) {
  const url = await validateWebhookUrl(input.url);
  const { secret, encrypted } = newSigningSecret();
  const webhook = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.instanceWebhookTable)
      .values({
        ...input,
        url,
        categories: [...new Set(input.categories)],
        signingSecret: encrypted,
      })
      .returning();
    if (!row) throw new Error("Webhook insert failed");
    await recordAdminAction(
      {
        ...audit,
        action: "webhook.created",
        targetType: "webhook",
        targetId: row.id,
      },
      tx,
    );
    return publicWebhook(row);
  });
  return { webhook, secret };
}
