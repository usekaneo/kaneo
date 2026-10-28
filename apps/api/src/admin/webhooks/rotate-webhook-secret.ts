import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { newSigningSecret } from "./new-signing-secret";
import { publicWebhook } from "./public-webhook";

export async function rotateWebhookSecret(
  id: string,
  audit: AdminAuditRequest,
) {
  const { secret, encrypted } = newSigningSecret();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.instanceWebhookTable)
      .set({ signingSecret: encrypted })
      .where(eq(schema.instanceWebhookTable.id, id))
      .returning();
    if (!row) throw new HTTPException(404, { message: "Webhook not found" });
    await recordAdminAction(
      {
        ...audit,
        action: "webhook.secret_rotated",
        targetType: "webhook",
        targetId: id,
      },
      tx,
    );
    return { webhook: publicWebhook(row), secret };
  });
}
