import { describe, expect, it } from "vitest";
import { verifyGitlabWebhookSecret } from "../../../../apps/api/src/plugins/gitlab/utils/verify-token";

describe("verifyGitlabWebhookSecret", () => {
  it("accepts a matching secret", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", "s3cr3t")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", "wrong")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", undefined)).toBe(false);
  });

  it("rejects when the stored secret is empty", () => {
    expect(verifyGitlabWebhookSecret("", "anything")).toBe(false);
  });

  it("rejects a same-prefix header of different length without throwing", () => {
    expect(verifyGitlabWebhookSecret("s3cr3t", "s3cr3")).toBe(false);
    expect(verifyGitlabWebhookSecret("s3cr3t", "s3cr3txx")).toBe(false);
  });
});
