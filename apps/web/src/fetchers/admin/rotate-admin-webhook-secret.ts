import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function rotateAdminWebhookSecret(webhookId: string) {
  const response = await client.admin.webhooks[":webhookId"][
    "rotate-secret"
  ].$post({ param: { webhookId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
