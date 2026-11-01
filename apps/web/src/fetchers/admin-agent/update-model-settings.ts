import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function updateAdminAgentSettings(
  policy: { model: string; models: string[] } | null,
) {
  const response = await client.admin.agent.settings.$patch({
    json: { policy },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
