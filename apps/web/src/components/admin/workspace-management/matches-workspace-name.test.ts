import { describe, expect, it } from "vite-plus/test";
import { matchesWorkspaceName } from "./matches-workspace-name";

describe("matchesWorkspaceName", () => {
  it("accepts the exact name, ignoring surrounding spaces", () => {
    expect(matchesWorkspaceName("Acme", "Acme")).toBe(true);
    expect(matchesWorkspaceName("  Acme ", "Acme")).toBe(true);
  });

  it("rejects other casing, partial names, and empty input", () => {
    expect(matchesWorkspaceName("acme", "Acme")).toBe(false);
    expect(matchesWorkspaceName("Acm", "Acme")).toBe(false);
    expect(matchesWorkspaceName("", "Acme")).toBe(false);
    expect(matchesWorkspaceName("", "  ")).toBe(false);
  });
});
