import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AutomationListQuery } from "@/types/agent-automation";

export default async function getAutomations(
  workspaceId: string,
  query: AutomationListQuery = {},
) {
  const response = await client.agent[":workspaceId"].automations.$get({
    param: { workspaceId },
    query: { ...query, limit: query.limit, offset: query.offset },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
