import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminModelCatalog(provider: string) {
  const response = await client.admin.agent.models.$get({
    query: { provider },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
