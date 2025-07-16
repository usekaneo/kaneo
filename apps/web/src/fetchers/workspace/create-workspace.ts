import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateWorkspaceRequest = InferRequestType<
  typeof client.workspace.$post
>["json"];

const createWorkspace = async ({
  name,
  description,
}: CreateWorkspaceRequest) => {
  const response = await client.workspace.$post({
    json: { name, description },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const workspace = await response.json();

  return workspace;
};

export default createWorkspace;
