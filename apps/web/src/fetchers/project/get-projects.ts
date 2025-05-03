import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetProjectsRequest = InferRequestType<
  (typeof client)["project"]["$get"]
>["query"];

async function getProjects({ workspaceId }: GetProjectsRequest) {
  if (!workspaceId) return;

  const response = await client.project.$get({ query: { workspaceId } });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getProjects;
