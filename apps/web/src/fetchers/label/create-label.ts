import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateLabelRequest = InferRequestType<
  (typeof client)["label"]["$post"]
>["json"];

async function createLabel({
  name,
  color,
  taskId,
  workspaceId,
}: CreateLabelRequest) {
  const response = await client.label.$post({
    json: {
      name,
      color,
      taskId,
      workspaceId,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default createLabel;
