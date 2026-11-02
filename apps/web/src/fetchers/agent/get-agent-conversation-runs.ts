import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getAgentConversationRuns(
  workspaceId: string,
  conversationId: string,
  offset = 0,
) {
  const response = await client.agent[":workspaceId"].conversations[
    ":conversationId"
  ].runs.$get({
    param: { workspaceId, conversationId },
    query: { limit: "10", offset: String(offset) },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getAgentConversationRuns;
