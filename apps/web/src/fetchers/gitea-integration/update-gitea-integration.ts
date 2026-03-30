import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";

export type UpdateGiteaIntegrationRequest = InferRequestType<
  (typeof client)["gitea-integration"]["project"][":projectId"]["$patch"]
>["json"];

async function updateGiteaIntegration(
  projectId: string,
  json: UpdateGiteaIntegrationRequest,
) {
  const response = await client["gitea-integration"].project[
    ":projectId"
  ].$patch({
    param: { projectId },
    json,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateGiteaIntegration;
