import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateActivityRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$post"]
>["json"];

async function createActivity({
  taskId,
  content,
  userId,
}: CreateActivityRequest) {
  const response = await client.activity.comment.$post({
    json: {
      taskId,
      content,
      userId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default createActivity;
