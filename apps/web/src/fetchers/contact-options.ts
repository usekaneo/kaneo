import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const options = client.contact.workspace[":workspaceId"].options;

export type ContactOptions = InferResponseType<typeof options.$get, 200>;
export type ContactOption = ContactOptions["types"][number];
export type ContactOptionKind = "type" | "region";
export type AddedContactOptions = {
  created: ContactOption[];
  skipped: string[];
};

// The API accepts at most this many names per request.
export const MAX_LABELS_PER_REQUEST = 500;

export async function listContactOptions(workspaceId: string) {
  const response = await options.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

// Pasted lists can be longer than one request allows, so send them in batches.
export async function addContactOptions(
  workspaceId: string,
  kind: ContactOptionKind,
  labels: string[],
): Promise<AddedContactOptions> {
  const result: AddedContactOptions = { created: [], skipped: [] };
  for (let i = 0; i < labels.length; i += MAX_LABELS_PER_REQUEST) {
    const response = await options.$post({
      param: { workspaceId },
      json: { kind, labels: labels.slice(i, i + MAX_LABELS_PER_REQUEST) },
    });
    if (!response.ok) throw await HttpError.fromResponse(response);
    const batch = await response.json();
    result.created.push(...batch.created);
    result.skipped.push(...batch.skipped);
  }
  return result;
}

export async function renameContactOption(
  workspaceId: string,
  kind: ContactOptionKind,
  key: string,
  label: string,
) {
  const response = await options[":kind"][":key"].$patch({
    param: { workspaceId, kind, key },
    json: { label },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function reorderContactOptions(
  workspaceId: string,
  kind: ContactOptionKind,
  keys: string[],
) {
  const response = await options[":kind"].order.$put({
    param: { workspaceId, kind },
    json: { keys },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteContactOption(
  workspaceId: string,
  kind: ContactOptionKind,
  key: string,
) {
  const response = await options[":kind"][":key"].$delete({
    param: { workspaceId, kind, key },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
