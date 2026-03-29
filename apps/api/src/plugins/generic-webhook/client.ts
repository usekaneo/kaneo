import { createHmac } from "node:crypto";

type GenericWebhookPayload = Record<string, unknown>;

export async function postToGenericWebhook(
  webhookUrl: string,
  payload: GenericWebhookPayload,
  secret?: string,
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["X-Kaneo-Signature"] = createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Generic webhook request failed (${response.status}): ${errorText}`,
    );
  }
}
