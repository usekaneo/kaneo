import { createHmac } from "node:crypto";
import * as Sentry from "@sentry/node";
import { assertPublicWebhookDestination } from "./config";

type GenericWebhookPayload = Record<string, unknown>;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const GENERIC_WEBHOOK_TIMEOUT_MS = 10_000;

export async function postToGenericWebhook(
  webhookUrl: string,
  payload: GenericWebhookPayload,
  secret?: string,
): Promise<void> {
  await assertPublicWebhookDestination(webhookUrl);

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["X-Kaneo-Signature"] = createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GENERIC_WEBHOOK_TIMEOUT_MS,
  );

  try {
    Sentry.addBreadcrumb({
      category: "integration",
      level: "info",
      data: { integration: "generic-webhook" },
    });
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel();
      throw new Error(
        `Generic webhook request was redirected (${response.status}); redirects are not followed`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Generic webhook request failed (${response.status}): ${errorText}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Generic webhook request timed out after ${GENERIC_WEBHOOK_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
