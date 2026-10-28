import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function importGitlabIssues(projectId: string) {
  const response = await client["gitlab-integration"]["import-issues"].$post({
    json: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default importGitlabIssues;
