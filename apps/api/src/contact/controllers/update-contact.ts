import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactTable } from "../../database/schema";

type UpdateContactInput = Partial<
  Pick<
    typeof contactTable.$inferInsert,
    "name" | "phone" | "email" | "type" | "region" | "notes"
  >
>;

async function updateContact(
  workspaceId: string,
  id: string,
  input: UpdateContactInput,
) {
  const [contact] = await db
    .update(contactTable)
    .set(input)
    .where(
      and(eq(contactTable.id, id), eq(contactTable.workspaceId, workspaceId)),
    )
    .returning();
  if (!contact) throw new HTTPException(404, { message: "Contact not found" });
  return contact;
}

export default updateContact;
