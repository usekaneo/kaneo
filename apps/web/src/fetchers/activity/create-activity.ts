import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateActivityRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$post"]
>["json"];

async function createActivity({
  taskId,
  content,
  userEmail,
}: CreateActivityRequest) {
  const response = await client.activity.comment.$post({
    json: {
      taskId,
      content,
      userEmail,
    },
  });

  const data = await response.json();

  return data;
}

export default createActivity;
