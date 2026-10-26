import { describe, expect, it } from "vite-plus/test";
import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

describe("sanitizeAuditMetadata", () => {
  it("drops credential-like keys at any depth", () => {
    expect(
      sanitizeAuditMetadata({
        reason: "Left",
        password: "hunter2",
        newPassword: "hunter3",
        sessionToken: "abc",
        nested: { apiKey: "kn_1", api_key: "kn_2", key: "k", secret: "s" },
        list: [{ token: "t", role: "admin" }],
      }),
    ).toEqual({ reason: "Left", nested: {}, list: [{ role: "admin" }] });
  });

  it("keeps ordinary values and removes undefined ones", () => {
    expect(
      sanitizeAuditMetadata({ role: "user", count: 2, gone: undefined }),
    ).toEqual({ role: "user", count: 2 });
  });
});
