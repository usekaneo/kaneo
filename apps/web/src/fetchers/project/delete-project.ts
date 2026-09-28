import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DeleteProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$delete"]
>["param"];

async function deleteProject({ id }: DeleteProjectRequest) {
  const response = await client.project[":id"].$delete({ param: { id } });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default deleteProject;
