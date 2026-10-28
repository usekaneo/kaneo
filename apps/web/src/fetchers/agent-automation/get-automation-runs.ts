import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function getAutomationRuns(
  workspaceId: string,
  automationId: string,
  query: { limit?: string; offset?: string } = {},
) {
  const response = await client.agent[":workspaceId"].automations[
    ":automationId"
  ].runs.$get({
    param: { workspaceId, automationId },
    query: { ...query, limit: query.limit, offset: query.offset },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
