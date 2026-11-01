import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { StartAgentCodeJobInput } from "@/types/agent";
export default async function startAgentCodeJob(
  workspaceId: string,
  input: StartAgentCodeJobInput,
) {
  const response = await client.agent[":workspaceId"].jobs.$post({
    param: { workspaceId },
    json: input,
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
