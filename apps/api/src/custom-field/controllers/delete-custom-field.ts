import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customFieldDefinitionTable } from "../../database/schema";

async function deleteCustomField(id: string) {
  const [deleted] = await db
    .delete(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.id, id))
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Custom field not found" });
  }

  return deleted;
}

export default deleteCustomField;