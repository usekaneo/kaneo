import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";

export type UpdateGithubIntegrationRequest = InferRequestType<
  (typeof client)["github-integration"]["project"][":projectId"]["$patch"]
>["json"];

async function updateGithubIntegration(
  projectId: string,
  json: UpdateGithubIntegrationRequest,
) {
  const response = await client["github-integration"].project[
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

export default updateGithubIntegration;
