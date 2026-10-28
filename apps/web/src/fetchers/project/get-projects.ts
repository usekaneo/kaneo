import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetProjectsRequest = InferRequestType<
  (typeof client)["project"]["$get"]
>["query"];

async function getProjects({
  workspaceId,
  includeArchived,
}: GetProjectsRequest) {
  if (!workspaceId) return;

  const response = await client.project.$get({
    query: includeArchived ? { workspaceId, includeArchived } : { workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default getProjects;
