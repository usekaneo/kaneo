import { resolveFileSecret } from "../../utils/file-secret";
import { desc } from "drizzle-orm";
import db, { schema } from "../../database";
import { publicWebhook } from "./public-webhook";

export async function listWebhooks() {
  const rows = await db
    .select()
    .from(schema.instanceWebhookTable)
    .orderBy(desc(schema.instanceWebhookTable.createdAt));
  return {
    webhooks: rows.map(publicWebhook),
    signingConfigured: Boolean(
      resolveFileSecret("NOTIFICATION_SECRET_ENCRYPTION_KEY")?.trim(),
    ),
  };
}
