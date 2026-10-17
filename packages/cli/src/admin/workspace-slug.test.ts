import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  checkWorkspaceSlug,
  deriveWorkspaceSlug,
  slugify,
} from "./workspace-slug.js";

describe("slugify", () => {
  it("lowercases and joins words with hyphens like the web app", () => {
    expect(slugify("  Acme Studio  ")).toBe("acme-studio");
    expect(slugify("R&D_Team -- 2026")).toBe("rd-team-2026");
  });

  it("drops characters outside ASCII words", () => {
    expect(slugify("Café Ünïcode!")).toBe("caf-ncode");
    expect(slugify("日本")).toBe("");
  });
});

describe("deriveWorkspaceSlug", () => {
  const random = () => "abc123def456";

  it("uses the plain slug when it is free", () => {
    expect(deriveWorkspaceSlug("Acme Studio", ["side-project"], random)).toBe(
      "acme-studio",
    );
  });

  it("adds a random suffix when the slug is taken, ignoring case", () => {
    expect(deriveWorkspaceSlug("Acme Studio", ["ACME-studio"], random)).toBe(
      "acme-studio-abc123def456",
    );
  });

  it("adds a suffix to reserved slugs", () => {
    expect(deriveWorkspaceSlug("Dashboard", [], random)).toBe(
      "dashboard-abc123def456",
    );
  });

  it("falls back to workspace for names without slug characters", () => {
    expect(deriveWorkspaceSlug("日本", [], random)).toBe("workspace");
  });

  it("draws again until the suffixed slug is free", () => {
    const draws = ["one", "two"];
    expect(
      deriveWorkspaceSlug(
        "Acme",
        ["acme", "acme-one"],
        () => draws.shift() ?? "",
      ),
    ).toBe("acme-two");
  });
});

describe("checkWorkspaceSlug", () => {
  it("accepts a clean slug", () => {
    expect(checkWorkspaceSlug(" acme-studio ")).toEqual(
      Result.succeed("acme-studio"),
    );
  });

  it("suggests the cleaned form of an invalid slug", () => {
    const result = checkWorkspaceSlug("Acme Studio");
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.hint).toContain("acme-studio");
    }
  });

  it("refuses reserved slugs", () => {
    const result = checkWorkspaceSlug("api");
    expect(Result.isFailure(result) && result.failure.message).toBe(
      '"api" is reserved by Kaneo.',
    );
  });
});
