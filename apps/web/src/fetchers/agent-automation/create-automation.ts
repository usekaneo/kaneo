import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AutomationInput } from "@/types/agent-automation";

export default async function createAutomation(
  workspaceId: string,
  input: AutomationInput,
) {
  const response = await client.agent[":workspaceId"].automations.$post({
    param: { workspaceId },
    json: input,
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
