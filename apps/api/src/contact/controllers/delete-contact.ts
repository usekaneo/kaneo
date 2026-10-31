import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactTable } from "../../database/schema";

// Linked tasks keep existing; their contactId is cleared by the foreign key.
async function deleteContact(workspaceId: string, id: string) {
  const [deleted] = await db
    .delete(contactTable)
    .where(
      and(eq(contactTable.id, id), eq(contactTable.workspaceId, workspaceId)),
    )
    .returning({ id: contactTable.id });
  if (!deleted) throw new HTTPException(404, { message: "Contact not found" });
  return deleted;
}

export default deleteContact;
