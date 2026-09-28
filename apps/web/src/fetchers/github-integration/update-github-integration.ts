import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

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
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateGithubIntegration;
