import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateProjectRequest = InferRequestType<
  (typeof client)["project"]["$post"]
>["json"];

async function createProject({
  name,
  slug,
  workspaceId,
  icon,
}: CreateProjectRequest) {
  const response = await client.project.$post({
    json: { name, slug, icon, workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default createProject;
