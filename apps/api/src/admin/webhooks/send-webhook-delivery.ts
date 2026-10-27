import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { decryptSecret } from "../../notification-preferences/secrets";
import {
  OutboundRequestError,
  sendOutboundRequest,
} from "../../utils/outbound-request";
import { pruneWebhookDeliveries } from "./prune-webhook-deliveries";
import {
  claimWebhookDelivery,
  MAX_WEBHOOK_ATTEMPTS,
} from "./claim-webhook-delivery";

export async function sendWebhookDelivery() {
  const job = await claimWebhookDelivery();
  if (!job) return false;
  const { delivery, url, signingSecret } = job;
  let statusCode: number | null = null;
  let errorCode: string | null = null;
  let retryable = false;
  try {
    const secret = decryptSecret(signingSecret);
    if (!secret) throw new Error("Missing signing secret");
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    statusCode = (await sendOutboundRequest(
      url,
      {
        body,
        headers: {
          "content-type": "application/json",
          "x-kaneo-timestamp": timestamp,
          "x-kaneo-signature": `sha256=${signature}`,
          "x-kaneo-delivery": delivery.id,
        },
      },
      { publicDestination: true, readStatus: true, timeoutMs: 5_000 },
    )) as number;
  } catch (error) {
    // Neither an untrusted response body nor an error containing a URL is kept.
    errorCode =
      error instanceof OutboundRequestError ? error.reason : "signing";
    statusCode =
      error instanceof OutboundRequestError ? (error.status ?? null) : null;
    retryable =
      errorCode === "network" ||
      errorCode === "timeout" ||
      (errorCode === "http" &&
        (statusCode === 408 || statusCode === 429 || (statusCode ?? 0) >= 500));
  }
  const retry =
    errorCode !== null && retryable && delivery.attempts < MAX_WEBHOOK_ATTEMPTS;
  const table = schema.instanceWebhookDeliveryTable;
  await db
    .update(table)
    .set({
      state: retry ? "pending" : errorCode ? "failed" : "succeeded",
      statusCode,
      errorCode,
      nextAttemptAt: new Date(
        Date.now() + (delivery.attempts === 1 ? 5_000 : 30_000),
      ),
    })
    .where(
      and(
        eq(table.id, delivery.id),
        eq(table.state, "pending"),
        eq(table.attempts, delivery.attempts),
      ),
    );
  await pruneWebhookDeliveries(db, delivery.webhookId);
  return true;
}
