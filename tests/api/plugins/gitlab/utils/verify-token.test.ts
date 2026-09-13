import { describe, expect, it } from "vitest";
import { verifyGitlabToken } from "../../../../../apps/api/src/plugins/gitlab/utils/verify-token";

describe("verifyGitlabToken", () => {
  const secret = "3f7a9c2e5b1d8046af32be7190c4d5e6";

  it("accepts the exact token GitLab echoes back", () => {
    expect(verifyGitlabToken(secret, secret)).toBe(true);
  });

  it("rejects a different token of the same length", () => {
    const other = `${secret.slice(0, -1)}0`;
    expect(other).toHaveLength(secret.length);
    expect(verifyGitlabToken(secret, other)).toBe(false);
  });

  it("rejects a token that only shares a prefix", () => {
    expect(verifyGitlabToken(secret, secret.slice(0, 8))).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyGitlabToken(secret, undefined)).toBe(false);
    expect(verifyGitlabToken(secret, "")).toBe(false);
  });

  it("rejects every token when no secret is configured", () => {
    expect(verifyGitlabToken("", "anything")).toBe(false);
  });
});
