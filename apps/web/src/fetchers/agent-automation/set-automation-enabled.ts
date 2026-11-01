import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function setAutomationEnabled(
  workspaceId: string,
  automationId: string,
  enabled: boolean,
) {
  const response = await client.agent[":workspaceId"].automations[
    ":automationId"
  ].enabled.$patch({ param: { workspaceId, automationId }, json: { enabled } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
