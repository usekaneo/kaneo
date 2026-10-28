import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AutomationInput } from "@/types/agent-automation";

export default async function updateAutomation(
  workspaceId: string,
  automationId: string,
  input: AutomationInput,
) {
  const response = await client.agent[":workspaceId"].automations[
    ":automationId"
  ].$put({ param: { workspaceId, automationId }, json: input });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
