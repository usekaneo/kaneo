import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getAgentConversations(workspaceId: string, projectId?: string) {
  const response = await client.agent[":workspaceId"].conversations.$get({
    param: { workspaceId },
    query: { limit: "20", offset: "0", ...(projectId ? { projectId } : {}) },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getAgentConversations;
