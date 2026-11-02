import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getAgentConversations(
  workspaceId: string,
  projectId?: string,
  offset = 0,
) {
  const response = await client.agent[":workspaceId"].conversations.$get({
    param: { workspaceId },
    query: {
      limit: "20",
      offset: String(offset),
      ...(projectId ? { projectId } : {}),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getAgentConversations;
