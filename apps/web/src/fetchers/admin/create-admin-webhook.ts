import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminWebhookValues } from "./webhook-types";

export async function createAdminWebhook(json: AdminWebhookValues) {
  const response = await client.admin.webhooks.$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
