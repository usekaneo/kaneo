import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function importGiteaIssues(data: {
  projectId: string;
  integrationId: string;
}) {
  const response = await client["gitea-integration"]["import-issues"].$post({
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default importGiteaIssues;
