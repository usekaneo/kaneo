import { timingSafeEqual } from "node:crypto";

// GitLab sends the secret back in X-Gitlab-Token instead of signing the body.
export function verifyWebhookToken(
  secret: string,
  tokenHeader: string | undefined,
): boolean {
  if (!tokenHeader || !secret) {
    return false;
  }

  const provided = Buffer.from(tokenHeader, "utf8");
  const expected = Buffer.from(secret, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
