import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateCustomFieldRequest = InferRequestType<
  (typeof client)["custom-field"][":id"]["$patch"]
>;

export default async function updateCustomField(
  request: UpdateCustomFieldRequest,
) {
  const response = await client["custom-field"][":id"].$patch(request);
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
