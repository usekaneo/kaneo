import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$get"]
>["param"] &
  InferRequestType<(typeof client)["project"][":id"]["$get"]>["query"];

async function getProject({ id, workspaceId }: GetProjectRequest) {
  const response = await client.project[":id"].$get({
    param: { id },
    query: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getProject;
