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
    const error = await response
      .clone()
      .json()
      .catch(async () => ({
        message: (await response.text()) || "Request failed",
      }));
    throw new HttpError(
      response.status,
      typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Request failed",
    );
  }

  return response.json();
}

export default createGiteaIntegration;
