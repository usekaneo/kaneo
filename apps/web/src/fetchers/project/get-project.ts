import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$get"]
>["param"] & {
  workspaceId: string;
};

async function getProject({ id }: GetProjectRequest) {
  const response = await client.project[":id"].$get({
    param: { id },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default getProject;
