import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetActiveWorkspaceUsersRequest = InferRequestType<
  (typeof client)["workspace-user"][":workspaceId"]["active"]["$get"]
>["param"];

async function getActiveWorkspaceUsers({
  workspaceId,
}: GetActiveWorkspaceUsersRequest) {
  const response = await client["workspace-user"][":workspaceId"].active.$get({
    param: { workspaceId },
  });

  const data = await response.json();

  return data;
}

export default getActiveWorkspaceUsers;
