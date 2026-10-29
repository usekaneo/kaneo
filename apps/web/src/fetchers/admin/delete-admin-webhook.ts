import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function deleteAdminWebhook(webhookId: string) {
  const response = await client.admin.webhooks[":webhookId"].$delete({
    param: { webhookId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
