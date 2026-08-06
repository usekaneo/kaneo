import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateCustomFieldRequest = InferRequestType<
  (typeof client)["custom-field"]["$post"]
>["json"];

async function createCustomField({
  projectId,
  workspaceId,
  name,
  type,
  required,
  defaultValue,
  options,
}: CreateCustomFieldRequest) {
  const response = await client["custom-field"].$post({
    json: {
      projectId,
      workspaceId,
      name,
      type,
      required,
      defaultValue,
      options,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createCustomField;
