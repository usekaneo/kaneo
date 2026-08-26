import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateProjectRequest = InferRequestType<
  (typeof client)["project"]["$post"]
>["json"];

async function createProject({
  name,
  slug,
  workspaceId,
  icon,
  clientId,
  projectType,
}: CreateProjectRequest) {
  const response = await client.project.$post({
    json: { name, slug, icon, workspaceId, clientId, projectType },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default createProject;
