import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateCommentRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$post"]
>["json"];

async function createComment({ taskId, comment }: CreateCommentRequest) {
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

export default createComment;
