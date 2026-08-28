import { timingSafeEqual } from "node:crypto";

/**
 * GitLab does not sign webhook bodies. It echoes back the secret token
 * configured on the hook in `X-Gitlab-Token`, so the check is a constant-time
 * comparison of that token rather than an HMAC over the payload.
 */
export function verifyGitlabWebhookToken(
  secret: string,
  tokenHeader: string | undefined,
): boolean {
  if (!tokenHeader || !secret) {
    return false;
  }

  const provided = Buffer.from(tokenHeader.trim(), "utf8");
  const expected = Buffer.from(secret, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
