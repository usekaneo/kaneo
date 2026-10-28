import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AdminWebhookValues } from "./webhook-types";

export async function updateAdminWebhook({
  webhookId,
  ...json
}: AdminWebhookValues & { webhookId: string }) {
  const response = await client.admin.webhooks[":webhookId"].$put({
    param: { webhookId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
