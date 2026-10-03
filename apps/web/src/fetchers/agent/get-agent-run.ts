import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getAgentRun(workspaceId: string, runId: string) {
  const response = await client.agent[":workspaceId"].runs[":runId"].$get({
    param: { workspaceId, runId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getAgentRun;
