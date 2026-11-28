import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a `sha256=<hex>` HMAC-SHA256 signature over the exact raw body bytes.
 * Hex digest characters may be lowercase or uppercase.
 */
export function verifyTangledSignature(
  rawBody: Uint8Array,
  secret: string,
  signature: string | undefined,
): boolean {
  if (!secret || !signature) return false;

  const match = /^sha256=([\da-f]{64})$/i.exec(signature);
  const digest = match?.[1];
  if (!digest) return false;

  const received = Buffer.from(digest, "hex");
  const expected = createHmac("sha256", secret).update(rawBody).digest();

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
