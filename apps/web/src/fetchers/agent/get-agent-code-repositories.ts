import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
export default async function getAgentCodeRepositories(workspaceId: string) {
  const response = await client.agent[":workspaceId"].code.repositories.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
