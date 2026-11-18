import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type UpdateGithubIntegrationRequest = InferRequestType<
  (typeof client)["github-integration"]["integration"][":integrationId"]["$patch"]
>["json"];

async function updateGithubIntegration(
  integrationId: string,
  json: UpdateGithubIntegrationRequest,
) {
  const response = await client["github-integration"].integration[
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

export default updateGithubIntegration;
