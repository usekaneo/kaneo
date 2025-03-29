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
  userEmail,
}: DeleteWorkspaceUserRequest) {
  const response = await client["workspace-user"][":workspaceId"].$delete({
    param: { workspaceId },
    query: { userEmail },
  });

  const data = await response.json();

  return data;
}

export default deleteWorkspaceUser;
