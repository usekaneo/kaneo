import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

type GetWorkspaceRequest = InferRequestType<
  (typeof client.workspace)[":id"]["$get"]
>["param"];

async function getWorkspace({ id }: GetWorkspaceRequest) {
  const response = await client.workspace[":id"].$get({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const workspace = await response.json();

  return workspace;
}

export default getWorkspace;
