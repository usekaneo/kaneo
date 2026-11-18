import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteGitlabIntegration(integrationId: string) {
  const response = await client["gitlab-integration"].integration[
    ":integrationId"
  ].$delete({
    param: { integrationId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteGitlabIntegration;
