import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateCommentRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$put"]
>["json"];

async function updateComment({ activityId, comment }: UpdateCommentRequest) {
  const response = await client.activity.comment.$put({
    json: {
      activityId,
      comment,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateComment;
