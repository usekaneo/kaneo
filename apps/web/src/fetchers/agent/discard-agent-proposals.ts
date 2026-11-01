import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function discardAgentProposals(
  workspaceId: string,
  runId: string,
  proposalIds: string[],
) {
  const response = await client.agent[":workspaceId"].runs[
    ":runId"
  ].discard.$post({
    param: { workspaceId, runId },
    json: { proposalIds },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default discardAgentProposals;
