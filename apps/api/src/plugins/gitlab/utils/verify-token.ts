import { timingSafeEqual } from "node:crypto";

/**
 * GitLab webhooks echo the configured secret verbatim in X-Gitlab-Token
 * (no HMAC, unlike GitHub/Gitea). Length is checked before timingSafeEqual
 * because that function throws on mismatched buffer lengths.
 */
export function verifyGitlabWebhookSecret(
  secret: string,
  tokenHeader: string | undefined,
): boolean {
  if (!tokenHeader || !secret) {
    return false;
  }

  const a = Buffer.from(tokenHeader);
  const b = Buffer.from(secret);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
