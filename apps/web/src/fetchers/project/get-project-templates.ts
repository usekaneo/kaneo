import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetProjectTemplatesRequest = InferRequestType<
  (typeof client)["project"]["templates"]["$get"]
>["query"];

async function getProjectTemplates({
  workspaceId,
}: GetProjectTemplatesRequest) {
  const response = await client.project.templates.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getProjectTemplates;
