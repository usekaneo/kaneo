import db from "../../database";
import { contactTable } from "../../database/schema";
import { resolveOptionKey } from "../options/resolve-option";
import { findContact } from "./find-contact";

type CreateContactInput = {
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  type?: string | null;
  region?: string | null;
  notes?: string | null;
};

async function createContact(input: CreateContactInput) {
  const type = await resolveOptionKey(input.workspaceId, "type", input.type);
  const region = await resolveOptionKey(
    input.workspaceId,
    "region",
    input.region,
  );
  const [created] = await db
    .insert(contactTable)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      type: type ?? null,
      region: region ?? null,
      notes: input.notes ?? null,
    })
    .returning({ id: contactTable.id });
  return findContact(input.workspaceId, (created as { id: string }).id);
}

export default createContact;
