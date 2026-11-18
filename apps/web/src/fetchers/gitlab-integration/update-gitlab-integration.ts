import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type UpdateGitlabIntegrationRequest = InferRequestType<
  (typeof client)["gitlab-integration"]["integration"][":integrationId"]["$patch"]
>["json"];

async function updateGitlabIntegration(
  integrationId: string,
  json: UpdateGitlabIntegrationRequest,
) {
  const response = await client["gitlab-integration"].integration[
    ":integrationId"
  ].$patch({
    param: { integrationId },
    json,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateGitlabIntegration;
