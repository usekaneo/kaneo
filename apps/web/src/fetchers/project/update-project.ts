import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$put"]
>["json"] &
  InferRequestType<(typeof client)["project"][":id"]["$put"]>["param"];

async function updateProject({
  id,
  name,
  icon,
  slug,
  description,
  isPublic,
}: UpdateProjectRequest) {
  const response = await client.project[":id"].$put({
    param: { id },
    json: { name, icon, slug, description, isPublic },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateProject;
