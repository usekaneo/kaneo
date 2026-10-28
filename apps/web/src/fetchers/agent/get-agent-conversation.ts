import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getAgentConversation(
  workspaceId: string,
  conversationId: string,
) {
  const response = await client.agent[":workspaceId"].conversations[
    ":conversationId"
  ].$get({
    param: { workspaceId, conversationId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getAgentConversation;
