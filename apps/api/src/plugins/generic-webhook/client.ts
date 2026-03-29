import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";

type GenericWebhookPayload = Record<string, unknown>;

const GENERIC_WEBHOOK_TIMEOUT_MS = 10_000;

function isDisallowedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isDisallowedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

function isDisallowedAddress(address: string): boolean {
  if (address === "localhost") {
    return true;
  }

  const version = net.isIP(address);
  if (version === 4) {
    return isDisallowedIpv4(address);
  }

  if (version === 6) {
    return isDisallowedIpv6(address);
  }

  return false;
}

async function assertPublicWebhookDestination(
  webhookUrl: string,
): Promise<void> {
  const url = new URL(webhookUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Generic webhook URL must use http or https");
  }

  if (isDisallowedAddress(url.hostname)) {
    throw new Error(
      "Generic webhook destination resolves to a non-routable address",
    );
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Generic webhook destination could not be resolved");
  }

  if (addresses.some((entry) => isDisallowedAddress(entry.address))) {
    throw new Error(
      "Generic webhook destination resolves to a non-routable address",
    );
  }
}

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
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

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
