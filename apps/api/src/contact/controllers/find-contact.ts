import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactTable } from "../../database/schema";
import { contactColumns } from "../contact-columns";

export async function findContact(workspaceId: string, id: string) {
  const [contact] = await db
    .select(contactColumns)
    .from(contactTable)
    .where(
      and(eq(contactTable.id, id), eq(contactTable.workspaceId, workspaceId)),
    );
  if (!contact) throw new HTTPException(404, { message: "Contact not found" });
  return contact;
}
