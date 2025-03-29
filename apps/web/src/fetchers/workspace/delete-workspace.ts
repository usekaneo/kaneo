import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

type DeleteWorkspaceRequest = InferRequestType<
  (typeof client.workspace)[":id"]["$delete"]
>["param"];

const deleteWorkspace = async ({ id }: DeleteWorkspaceRequest) => {
  const response = await client.workspace[":id"].$delete({
    param: { id },
  });

  const workspace = await response.json();

  return workspace;
};

export default deleteWorkspace;
