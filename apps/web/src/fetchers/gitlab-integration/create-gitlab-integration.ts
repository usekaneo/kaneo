import { client } from "@kaneo/libs";

export type CreateGitlabIntegrationRequest = {
  baseUrl: string;
  accessToken?: string;
  repositoryPath: string;
};

async function createGitlabIntegration(
  projectId: string,
  data: CreateGitlabIntegrationRequest,
) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response
      .clone()
      .json()
      .catch(async () => ({
        message: (await response.text()) || "Request failed",
      }));
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Request failed",
    );
  }

  return response.json();
}

export default createGitlabIntegration;
