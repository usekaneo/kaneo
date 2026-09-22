import { createHmac } from "node:crypto";
import * as Sentry from "@sentry/node";
import { sendOutboundRequest } from "../../utils/outbound-request";

type GenericWebhookPayload = Record<string, unknown>;

export async function postToGenericWebhook(
  webhookUrl: string,
  payload: GenericWebhookPayload,
  secret?: string,
): Promise<void> {
  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: { integration: "generic-webhook" },
  });
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["X-Kaneo-Signature"] = createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }

  await sendOutboundRequest(
    webhookUrl,
    { headers, body },
    { publicDestination: true },
  );
}
