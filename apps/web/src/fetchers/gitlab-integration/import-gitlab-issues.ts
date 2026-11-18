import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function importGitlabIssues(data: {
  projectId: string;
  integrationId: string;
}) {
  const response = await client["gitlab-integration"]["import-issues"].$post({
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default importGitlabIssues;
