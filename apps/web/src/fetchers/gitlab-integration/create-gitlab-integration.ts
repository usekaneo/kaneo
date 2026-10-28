import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type CreateGitlabIntegrationRequest = {
  baseUrl: string;
  accessToken?: string;
  tokenType?: "private" | "bearer";
  projectPath: string;
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
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createGitlabIntegration;
