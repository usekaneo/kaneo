import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type UpdateGitlabIntegrationRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["project"][":projectId"]["$patch"]
>["json"];

async function updateGitlabIntegration(
  projectId: string,
  json: UpdateGitlabIntegrationRequest,
) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$patch({
    param: { projectId },
    json,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateGitlabIntegration;
