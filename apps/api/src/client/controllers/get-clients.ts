import { eq } from "drizzle-orm";
import db from "../../database";
import { clientTable } from "../../database/schema";

async function getClients(workspaceId: string) {
  return db
    .select()
    .from(clientTable)
    .where(eq(clientTable.workspaceId, workspaceId))
    .orderBy(clientTable.name);
}

export default getClients;
