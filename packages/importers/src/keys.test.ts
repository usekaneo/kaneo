import { describe, expect, it } from "vite-plus/test";
import {
  sanitizeProjectKey,
  toColumnSlug,
  toProjectKey,
  uniqueKey,
} from "./keys.js";

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

describe("sanitizeProjectKey", () => {
  it("keeps a clean source key", () => {
    expect(sanitizeProjectKey("WEB")).toBe("WEB");
    expect(sanitizeProjectKey("ENG2")).toBe("ENG2");
  });

  it("uppercases and drops anything but letters and digits", () => {
    expect(sanitizeProjectKey(" web-app_1 ")).toBe("WEBAPP1");
    expect(sanitizeProjectKey("ops.team")).toBe("OPSTEAM");
  });

  it("normalizes compatibility characters", () => {
    expect(sanitizeProjectKey("ＷＥＢ")).toBe("WEB");
    expect(sanitizeProjectKey("ｗｅｂ")).toBe("WEB");
  });

  it("keeps non-latin letters", () => {
    expect(sanitizeProjectKey("гот")).toBe("ГОТ");
  });

  it("caps at 16 code points without splitting one", () => {
    expect(sanitizeProjectKey("ABCDEFGHIJKLMNOPQRS")).toBe("ABCDEFGHIJKLMNOP");
    const astral = "𠀀".repeat(20);
    expect(Array.from(sanitizeProjectKey(astral) ?? "")).toEqual(
      Array.from("𠀀".repeat(16)),
    );
  });

  it("returns null when nothing usable is left", () => {
    expect(sanitizeProjectKey("")).toBeNull();
    expect(sanitizeProjectKey("  -_. ")).toBeNull();
    expect(sanitizeProjectKey(null)).toBeNull();
    expect(sanitizeProjectKey(undefined)).toBeNull();
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

  it("keeps longer keys when given a larger cap", () => {
    expect(uniqueKey("MARKETING", new Set(["MARKETING"]), 16)).toBe(
      "MARKETING-2",
    );
  });

  it("does not split a code point when suffixing", () => {
    const candidate = "𠀀".repeat(8);
    expect(Array.from(uniqueKey(candidate, new Set([candidate])))).toEqual(
      Array.from(`${"𠀀".repeat(6)}-2`),
    );
  });
});

describe("toProjectKey with characters outside the basic plane", () => {
  it("keeps whole code points when taking initials", () => {
    expect(toProjectKey("𠀀abc 𠀁def")).toBe("𠀀𠀁");
  });

  it("does not split a code point when truncating", () => {
    expect(Array.from(toProjectKey("𠀀𠀁𠀂𠀃𠀄𠀅𠀆𠀇𠀈"))).toEqual(
      Array.from("𠀀𠀁𠀂𠀃𠀄𠀅𠀆𠀇"),
    );
  });
});
