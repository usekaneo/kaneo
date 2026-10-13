import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteGitlabIntegration(projectId: string) {
  const response = await client["gitlab-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteGitlabIntegration;
