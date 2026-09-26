import { client } from "@kaneo/libs";

async function importGitlabIssues(projectId: string) {
  const response = await client["gitlab-integration"]["import-issues"].$post({
    json: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default importGitlabIssues;
