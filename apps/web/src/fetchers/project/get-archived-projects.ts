import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetArchivedProjectsRequest = InferRequestType<
  (typeof client)["project"]["archived"]["$get"]
>["query"];

async function getArchivedProjects({
  workspaceId,
}: GetArchivedProjectsRequest) {
  if (!workspaceId) return;

  const response = await client.project.archived.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getArchivedProjects;
