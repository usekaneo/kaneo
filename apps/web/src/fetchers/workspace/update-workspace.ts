import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

type UpdateWorkspaceRequest = InferRequestType<
  (typeof client.workspace)[":id"]["$put"]
>["param"] &
  InferRequestType<(typeof client.workspace)[":id"]["$put"]>["json"];

const updateWorkspace = async ({
  id,
  name,
  description,
}: UpdateWorkspaceRequest) => {
  const response = await client.workspace[":id"].$put({
    param: { id },
    json: { name, description },
  });

  const workspace = await response.json();

  return workspace;
};

export default updateWorkspace;
