import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateLabelRequest = InferRequestType<
  (typeof client)["label"]["$post"]
>["json"];

async function createLabel({ name, color, taskId }: CreateLabelRequest) {
  const response = await client.label.$post({
    json: {
      name,
      color,
      taskId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default createLabel;
