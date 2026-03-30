import { client } from "@kaneo/libs";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createGiteaIntegration;
