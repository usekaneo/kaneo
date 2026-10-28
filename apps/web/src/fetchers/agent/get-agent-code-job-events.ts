import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
export default async function getAgentCodeJobEvents(
  workspaceId: string,
  jobId: string,
  after = 0,
) {
  const response = await client.agent[":workspaceId"].jobs[
    ":jobId"
  ].events.$get({
    param: { workspaceId, jobId },
    query: { after: String(after) },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
