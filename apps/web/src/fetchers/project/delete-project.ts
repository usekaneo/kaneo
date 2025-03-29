import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type DeleteProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$delete"]
>["param"];

async function deleteProject({ id }: DeleteProjectRequest) {
  const response = await client.project[":id"].$delete({ param: { id } });

  const data = await response.json();

  return data;
}

export default deleteProject;
