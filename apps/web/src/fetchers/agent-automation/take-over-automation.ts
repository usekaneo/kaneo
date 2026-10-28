import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function takeOverAutomation(
  workspaceId: string,
  automationId: string,
) {
  const response = await client.agent[":workspaceId"].automations[
    ":automationId"
  ]["take-over"].$post({ param: { workspaceId, automationId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
