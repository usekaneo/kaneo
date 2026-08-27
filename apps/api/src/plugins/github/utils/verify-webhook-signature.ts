import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a GitHub webhook delivery against a per-project secret.
 *
 * GitHub signs the raw request body with HMAC-SHA256 and sends it as
 * `x-hub-signature-256: sha256=<hex>`. PAT-based integrations register the
 * webhook with their own generated secret, so deliveries for those repos are
 * verified here rather than by the shared GitHub App's webhook secret.
 */
export function verifyGithubWebhookSignature(
  secret: string,
  signatureHeader: string | undefined,
  rawBody: string,
): boolean {
  if (!secret || !signatureHeader) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, so gate on length first.
  if (received.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(received, computed);
}
