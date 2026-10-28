import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";

export async function requireWebhook(id: string, database: DbOrTx = db) {
  const [webhook] = await database
    .select()
    .from(schema.instanceWebhookTable)
    .where(eq(schema.instanceWebhookTable.id, id));
  if (!webhook) throw new HTTPException(404, { message: "Webhook not found" });
  return webhook;
}
