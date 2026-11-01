import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function setAgentConversationSharing(
  workspaceId: string,
  conversationId: string,
  shared: boolean,
) {
  const routes = client.agent[":workspaceId"].conversations[":conversationId"];
  const request = { param: { workspaceId, conversationId } };
  const response = shared
    ? await routes.share.$post(request)
    : await routes.unshare.$post(request);

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default setAgentConversationSharing;
