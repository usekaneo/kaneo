import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type ReactToCommentRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["reactions"]["$post"]
>["json"];

async function reactToComment({ activityId, emoji }: ReactToCommentRequest) {
  const response = await client.activity.comment.reactions.$post({
    json: { activityId, emoji },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default reactToComment;
