import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
export default async function cancelAgentCodeJob(
  workspaceId: string,
  jobId: string,
) {
  const response = await client.agent[":workspaceId"].jobs[
    ":jobId"
  ].cancel.$post({ param: { workspaceId, jobId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
