import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateActivityRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$post"]
>["json"];

async function createActivity({ taskId, comment }: CreateActivityRequest) {
  const response = await client.activity.comment.$post({
    json: {
      taskId,
      comment,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default createActivity;
