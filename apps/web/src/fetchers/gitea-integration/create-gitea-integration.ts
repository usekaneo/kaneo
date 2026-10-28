import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
export type CreateGiteaIntegrationRequest = {
  baseUrl: string;
  accessToken?: string;
  repositoryOwner: string;
  repositoryName: string;
};

async function createGiteaIntegration(
  projectId: string,
  data: CreateGiteaIntegrationRequest,
) {
  const response = await client["gitea-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createGiteaIntegration;
