import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteCommentRequest = InferRequestType<
  (typeof client)["activity"]["comment"][":id"]["$delete"]
>["param"];

async function deleteComment({ id }: DeleteCommentRequest) {
  const response = await client.activity.comment[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default deleteComment;
