import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactTable } from "../../database/schema";
import { resolveOptionKey } from "../options/resolve-option";
import { findContact } from "./find-contact";

type UpdateContactInput = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  type?: string | null;
  region?: string | null;
  notes?: string | null;
};

async function updateContact(
  workspaceId: string,
  id: string,
  { type, region, ...input }: UpdateContactInput,
) {
  const [updated] = await db
    .update(contactTable)
    .set({
      ...input,
      type: await resolveOptionKey(workspaceId, "type", type),
      region: await resolveOptionKey(workspaceId, "region", region),
    })
    .where(
      and(eq(contactTable.id, id), eq(contactTable.workspaceId, workspaceId)),
    )
    .returning({ id: contactTable.id });
  if (!updated) throw new HTTPException(404, { message: "Contact not found" });
  return findContact(workspaceId, id);
}

export default updateContact;
