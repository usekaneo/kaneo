import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";

export async function deleteWebhook(id: string, audit: AdminAuditRequest) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(schema.instanceWebhookTable)
      .where(eq(schema.instanceWebhookTable.id, id))
      .returning({ id: schema.instanceWebhookTable.id });
    if (!row) throw new HTTPException(404, { message: "Webhook not found" });
    await recordAdminAction(
      {
        ...audit,
        action: "webhook.deleted",
        targetType: "webhook",
        targetId: id,
      },
      tx,
    );
    return row;
  });
}
