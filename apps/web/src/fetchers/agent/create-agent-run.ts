import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type { AgentRunAttachmentInput } from "@/types/agent";

async function createAgentRun(
  workspaceId: string,
  conversationId: string,
  input: {
    requestId: string;
    prompt: string;
    attachments: AgentRunAttachmentInput[];
    model?: string;
  },
) {
  const response = await client.agent[":workspaceId"].conversations[
    ":conversationId"
  ].runs.$post({
    param: { workspaceId, conversationId },
    json: input,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default createAgentRun;
