import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetWorkspaceUsersRequest = InferRequestType<
  (typeof client)["workspace-user"][":workspaceId"]["$get"]
>;

async function getWorkspaceUsers({ param }: GetWorkspaceUsersRequest) {
  const response = await client["workspace-user"][":workspaceId"].$get({
    param,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getWorkspaceUsers;
