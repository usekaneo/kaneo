import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateCommentRequest = InferRequestType<
  (typeof client)["activity"]["comment"]["$put"]
>["json"];

async function updateComment({ id, content, userId }: UpdateCommentRequest) {
  const response = await client.activity.comment.$put({
    json: {
      id,
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

export default updateComment;
