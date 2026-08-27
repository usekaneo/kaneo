import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGithubWebhookSignature } from "../../../../../apps/api/src/plugins/github/utils/verify-webhook-signature";

function sign(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyGithubWebhookSignature", () => {
  const secret = "per-project-secret";
  const body = '{"action":"closed","issue":{"number":45}}';

  it("accepts a correctly signed body", () => {
    expect(verifyGithubWebhookSignature(secret, sign(secret, body), body)).toBe(
      true,
    );
  });

  it("rejects a body signed with a different secret", () => {
    expect(
      verifyGithubWebhookSignature(secret, sign("other-secret", body), body),
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    const signature = sign(secret, body);
    expect(verifyGithubWebhookSignature(secret, signature, `${body} `)).toBe(
      false,
    );
  });

  it("rejects a missing signature or secret", () => {
    expect(verifyGithubWebhookSignature(secret, undefined, body)).toBe(false);
    expect(verifyGithubWebhookSignature("", sign(secret, body), body)).toBe(
      false,
    );
  });

  it("rejects a malformed signature without throwing", () => {
    expect(verifyGithubWebhookSignature(secret, "sha256=zz", body)).toBe(false);
    expect(verifyGithubWebhookSignature(secret, "garbage", body)).toBe(false);
  });
});
