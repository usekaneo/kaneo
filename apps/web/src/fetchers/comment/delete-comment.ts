import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteCommentRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$delete"]
>["json"];

async function deleteComment({ activityId }: DeleteCommentRequest) {
  const response = await client.activity.comment.$delete({
    json: { activityId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default deleteComment;
