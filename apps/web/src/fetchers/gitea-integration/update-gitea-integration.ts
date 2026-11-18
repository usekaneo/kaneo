import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type UpdateGiteaIntegrationRequest = InferRequestType<
  (typeof client)["gitea-integration"]["integration"][":integrationId"]["$patch"]
>["json"];

async function updateGiteaIntegration(
  integrationId: string,
  json: UpdateGiteaIntegrationRequest,
) {
  const response = await client["gitea-integration"].integration[
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

export default updateGiteaIntegration;
