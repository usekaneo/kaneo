import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default setCustomFieldValue;