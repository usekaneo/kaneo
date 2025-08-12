import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteWorkspaceUserRequest = InferRequestType<
  (typeof client)["workspace-user"][":workspaceId"]["$delete"]
>["param"] &
  InferRequestType<
    (typeof client)["workspace-user"][":workspaceId"]["$delete"]
  >["query"];

async function deleteWorkspaceUser({
  workspaceId,
  userId,
}: DeleteWorkspaceUserRequest) {
  const response = await client["workspace-user"][":workspaceId"].$delete({
    param: { workspaceId },
    query: { userId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default deleteWorkspaceUser;
