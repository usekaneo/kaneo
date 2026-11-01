import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminAgentSettings() {
  const response = await client.admin.agent.settings.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
