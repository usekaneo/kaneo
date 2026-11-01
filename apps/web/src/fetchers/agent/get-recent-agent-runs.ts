import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getRecentAgentRuns(workspaceId: string) {
  const response = await client.agent[":workspaceId"].runs.$get({
    param: { workspaceId },
    query: { limit: "8", offset: "0" },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getRecentAgentRuns;
