import { describe, expect, it } from "vitest";
import { toColumnSlug, toProjectKey, uniqueKey } from "./keys.js";

describe("toColumnSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(toColumnSlug("In Progress")).toBe("in-progress");
    expect(toColumnSlug("To Do")).toBe("to-do");
  });

  it("strips punctuation and edge hyphens", () => {
    expect(toColumnSlug("  Ready?! for review  ")).toBe("ready-for-review");
    expect(toColumnSlug("--Done--")).toBe("done");
  });

  it("keeps non-latin letters", () => {
    expect(toColumnSlug("Готово")).toBe("готово");
  });

  it("returns empty for names with no alphanumerics", () => {
    expect(toColumnSlug("???")).toBe("");
    expect(toColumnSlug("   ")).toBe("");
  });
});

describe("toProjectKey", () => {
  it("uses initials for multi-word names", () => {
    expect(toProjectKey("Marketing Website Redesign")).toBe("MWR");
  });

  it("uses a prefix for single-word names", () => {
    expect(toProjectKey("Engineering")).toBe("ENGINEER");
  });

  it("caps at 8 characters", () => {
    expect(toProjectKey("a b c d e f g h i j k").length).toBeLessThanOrEqual(8);
  });

  it("falls back when the name has nothing usable", () => {
    expect(toProjectKey("???")).toBe("PROJ");
    expect(toProjectKey("")).toBe("PROJ");
  });
});

describe("uniqueKey", () => {
  it("returns the candidate when free", () => {
    expect(uniqueKey("ENG", new Set())).toBe("ENG");
  });

  it("suffixes on collision", () => {
    expect(uniqueKey("ENG", new Set(["ENG"]))).toBe("ENG-2");
    expect(uniqueKey("ENG", new Set(["ENG", "ENG-2"]))).toBe("ENG-3");
  });

  it("stays within the length cap when suffixing", () => {
    const result = uniqueKey("ENGINEER", new Set(["ENGINEER"]));
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result).toBe("ENGINE-2");
  });
});
