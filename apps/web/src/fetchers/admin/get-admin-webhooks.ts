import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminWebhooks() {
  const response = await client.admin.webhooks.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
