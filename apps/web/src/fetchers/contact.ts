import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import type {
  ContactRegion,
  ContactType,
} from "@/components/contacts/contact-options";
import { HttpError } from "@/lib/http-error";

const contacts = client.contact.workspace[":workspaceId"];

export type Contact = InferResponseType<typeof contacts.$get, 200>[number];

export type ContactFields = {
  name: string;
  phone: string | null;
  email: string | null;
  type: ContactType;
  region: ContactRegion;
  notes: string | null;
};

export type ContactFilters = {
  search?: string;
  type?: ContactType;
  region?: ContactRegion;
};

export async function listContacts(
  workspaceId: string,
  filters: ContactFilters = {},
) {
  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value),
  );
  const response = await contacts.$get({ param: { workspaceId }, query });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createContact(
  workspaceId: string,
  fields: ContactFields,
) {
  const response = await contacts.$post({
    param: { workspaceId },
    json: fields,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateContact(
  workspaceId: string,
  id: string,
  fields: ContactFields,
) {
  const response = await contacts[":id"].$patch({
    param: { workspaceId, id },
    json: fields,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteContact(workspaceId: string, id: string) {
  const response = await contacts[":id"].$delete({
    param: { workspaceId, id },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setTaskContact(taskId: string, contactId: string | null) {
  const response = await client.task.contact[":id"].$put({
    param: { id: taskId },
    json: { contactId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
