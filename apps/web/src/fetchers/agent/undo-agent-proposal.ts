import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function undoAgentProposal(workspaceId: string, proposalId: string) {
  const response = await client.agent[":workspaceId"].proposals[
    ":proposalId"
  ].undo.$post({
    param: { workspaceId, proposalId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default undoAgentProposal;
