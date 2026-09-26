import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function importGiteaIssues(projectId: string) {
  const response = await client["gitea-integration"]["import-issues"].$post({
    json: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default importGiteaIssues;
