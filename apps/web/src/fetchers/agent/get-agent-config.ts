import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getAgentConfig(workspaceId: string) {
  const response = await client.agent[":workspaceId"].config.$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getAgentConfig;
