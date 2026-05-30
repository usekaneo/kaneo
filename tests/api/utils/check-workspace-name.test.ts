import { describe, expect, it } from "vitest";
import { checkWorkspaceName } from "../../../apps/api/src/utils/check-workspace-name";

describe("checkWorkspaceName", () => {
  it("accepts normal workspace names", () => {
    expect(checkWorkspaceName("Acme Inc.").ok).toBe(true);
    expect(checkWorkspaceName("My Team — Project").ok).toBe(true);
    expect(checkWorkspaceName("Crypto Snack").ok).toBe(true);
  });

  it("rejects names with embedded URLs (2026-05-28 phishing pattern)", () => {
    const result = checkWorkspaceName(
      "BANK OPER https://ij5205.craftum.io/page2",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects names longer than 100 characters", () => {
    const result = checkWorkspaceName("a".repeat(101));
    expect(result.ok).toBe(false);
  });

  it("rejects names with HTML / template chars", () => {
    expect(checkWorkspaceName("<!DOCTYPE html><script>").ok).toBe(false);
    expect(checkWorkspaceName("hello {{name}}").ok).toBe(false);
  });

  it("rejects empty / whitespace-only names", () => {
    expect(checkWorkspaceName("").ok).toBe(false);
    expect(checkWorkspaceName("   ").ok).toBe(false);
  });

  it("returns the rejection reason as a string", () => {
    const r = checkWorkspaceName("a".repeat(150));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.reason).toBe("string");
  });
});
