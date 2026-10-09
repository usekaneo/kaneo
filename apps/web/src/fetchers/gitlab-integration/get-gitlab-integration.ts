import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getGitlabIntegration(projectId: string) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export default getGitlabIntegration;
