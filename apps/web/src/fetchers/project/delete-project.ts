import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$delete"]
>["param"] &
  Partial<
    NonNullable<
      InferRequestType<(typeof client)["project"][":id"]["$delete"]>["query"]
    >
  >;

async function deleteProject({ id, workspaceId }: DeleteProjectRequest) {
  const response = await client.project[":id"].$delete({
    param: { id },
    query: workspaceId ? { workspaceId } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default deleteProject;
