import { describe, expect, it } from "vite-plus/test";
import { createUniqueWorkspaceSlug } from "./create-workspace-slug";

describe("createUniqueWorkspaceSlug", () => {
  it("keeps the base slug when it is free", () => {
    expect(createUniqueWorkspaceSlug("My Team", [])).toBe("my-team");
  });

  it("adds a 12-character hex suffix when the slug is taken", () => {
    expect(createUniqueWorkspaceSlug("My Team", ["my-team"])).toMatch(
      /^my-team-[0-9a-f]{12}$/,
    );
  });

  it("adds a suffix on plain-HTTP origins without crypto.randomUUID", () => {
    const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    try {
      // "api" is reserved, so a random suffix is always required.
      expect(createUniqueWorkspaceSlug("api", [])).toMatch(
        /^api-[0-9a-f]{12}$/,
      );
    } finally {
      if (original) Object.defineProperty(crypto, "randomUUID", original);
      else delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });
});
