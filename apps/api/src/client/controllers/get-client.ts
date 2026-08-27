import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { clientPartnerTable, clientTable } from "../../database/schema";

async function getClient(id: string, workspaceId: string) {
  const [client] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, id))
    .limit(1);

  if (!client || client.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Client not found" });
  }

  const partners = await db
    .select()
    .from(clientPartnerTable)
    .where(eq(clientPartnerTable.clientId, id));

  return { ...client, partners };
}

export default getClient;
