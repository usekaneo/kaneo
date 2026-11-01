import db from "../../database";
import { contactTable } from "../../database/schema";
import type { ContactRegion, ContactType } from "../options";

type CreateContactInput = {
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  type: ContactType;
  region: ContactRegion;
  notes?: string | null;
};

async function createContact(input: CreateContactInput) {
  const [contact] = await db
    .insert(contactTable)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      type: input.type,
      region: input.region,
      notes: input.notes ?? null,
    })
    .returning();
  return contact;
}

export default createContact;
