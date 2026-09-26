import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SetCustomFieldValueRequest = InferRequestType<
  (typeof client)["custom-field"]["value"]["$put"]
>["json"];

async function setCustomFieldValue({
  taskId,
  fieldId,
  value,
}: SetCustomFieldValueRequest) {
  const response = await client["custom-field"].value.$put({
    json: { taskId, fieldId, value },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default setCustomFieldValue;
