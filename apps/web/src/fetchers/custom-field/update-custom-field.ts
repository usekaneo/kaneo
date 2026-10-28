import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateCustomFieldRequest = InferRequestType<
  (typeof client)["custom-field"][":id"]["$put"]
>["json"];

async function updateCustomField(id: string, json: UpdateCustomFieldRequest) {
  const response = await client["custom-field"][":id"].$put({
    param: { id },
    json,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateCustomField;
