import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$put"]
>["json"] &
  InferRequestType<(typeof client)["project"][":id"]["$put"]>["param"];

async function updateProject({ id, name, icon, slug }: UpdateProjectRequest) {
  const response = await client.project[":id"].$put({
    param: { id },
    json: { name, icon, slug },
  });

  const data = await response.json();

  return data;
}

export default updateProject;
