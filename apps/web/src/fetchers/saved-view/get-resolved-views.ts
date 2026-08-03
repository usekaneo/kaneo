import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetResolvedViewsRequest = InferRequestType<
  (typeof client)["saved-view"]["workspace"][":workspaceId"]["project"][":projectId"]["$get"]
>["param"];

async function getResolvedViews({
  workspaceId,
  projectId,
}: GetResolvedViewsRequest) {
  const response = await client["saved-view"].workspace[":workspaceId"].project[
    ":projectId"
  ].$get({
    param: { workspaceId, projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getResolvedViews;
