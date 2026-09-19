import { describe, expect, it } from "vitest";
import { tokenFingerprint } from "./token-fingerprint";

describe("tokenFingerprint", () => {
  it("is stable for the same token", () => {
    expect(tokenFingerprint("glpat-abc123")).toBe(
      tokenFingerprint("glpat-abc123"),
    );
  });

  it("changes when the token changes", () => {
    expect(tokenFingerprint("glpat-abc123")).not.toBe(
      tokenFingerprint("glpat-abc124"),
    );
  });

  it("returns a short hex digest rather than the token", () => {
    expect(tokenFingerprint("glpat-abc123")).toMatch(/^[0-9a-f]{8}$/);
  });
});
