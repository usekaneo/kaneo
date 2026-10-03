import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function createAgentConversation(
  workspaceId: string,
  input: { projectId?: string; title: string },
) {
  const response = await client.agent[":workspaceId"].conversations.$post({
    param: { workspaceId },
    json: input,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default createAgentConversation;
