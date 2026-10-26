import { describe, expect, it } from "vite-plus/test";
import { credentialSetStatus } from "./credential-set-status";

describe("credentialSetStatus", () => {
  it("is ok when every value is set", () => {
    expect(credentialSetStatus(["id", "secret"])).toBe("ok");
  });

  it("is not configured when nothing is set", () => {
    expect(credentialSetStatus([undefined, "", "  "])).toBe("not_configured");
  });

  it("warns about a half-finished configuration", () => {
    expect(credentialSetStatus(["id", undefined])).toBe("warning");
    expect(credentialSetStatus(["", "secret", "key"])).toBe("warning");
  });
});
