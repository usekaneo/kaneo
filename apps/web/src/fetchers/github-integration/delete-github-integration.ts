import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteGithubIntegration(integrationId: string) {
  const response = await client["github-integration"].integration[
    ":integrationId"
  ].$delete({
    param: { integrationId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const result = await response.json();
  return result;
}

export default deleteGithubIntegration;
