import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteGithubIntegration(projectId: string) {
  const response = await client["github-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const result = await response.json();
  return result;
}

export default deleteGithubIntegration;
