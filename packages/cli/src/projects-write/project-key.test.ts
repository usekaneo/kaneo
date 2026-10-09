import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  deriveProjectKey,
  suggestProjectKey,
  validateProjectKey,
} from "./project-key.js";

describe("deriveProjectKey", () => {
  it("takes the first three letters of a single word, like the web app", () => {
    expect(deriveProjectKey("Kaneo")).toBe("KAN");
  });

  it("takes the initials of the first three words", () => {
    expect(deriveProjectKey("Kaneo Web")).toBe("KW");
    expect(deriveProjectKey("Alpha Beta Gamma Delta")).toBe("ABG");
  });

  it("ignores punctuation and leading separators", () => {
    expect(deriveProjectKey(" - Alpha Beta Gamma")).toBe("ABG");
    expect(deriveProjectKey("[Alpha] Beta Gamma")).toBe("ABG");
    expect(deriveProjectKey("Sprint 2")).toBe("S2");
  });

  it("keeps non-Latin scripts and counts code points", () => {
    expect(deriveProjectKey("Проект Альфа")).toBe("ПА");
    expect(deriveProjectKey("测试项目")).toBe("测试项");
    expect(deriveProjectKey("𠀀𠀁𠀂𠀃")).toBe("𠀀𠀁𠀂");
  });

  it("folds full-width characters", () => {
    expect(deriveProjectKey("ＡＢＣ")).toBe("ABC");
  });

  it("returns an empty key when the name has no letters or numbers", () => {
    expect(deriveProjectKey("!!!")).toBe("");
  });
});

describe("validateProjectKey", () => {
  it("upper-cases and trims the key", () => {
    expect(Result.getOrThrow(validateProjectKey(" web "))).toBe("WEB");
  });

  it("rejects empty, long and punctuated keys", () => {
    expect(Result.isFailure(validateProjectKey("  "))).toBe(true);
    expect(Result.isFailure(validateProjectKey("ABCDEFGHI"))).toBe(true);
    expect(Result.isFailure(validateProjectKey("WEB-2"))).toBe(true);
    expect(Result.isFailure(validateProjectKey("WE B"))).toBe(true);
  });

  it("accepts eight letters and digits", () => {
    expect(Result.getOrThrow(validateProjectKey("abcd1234"))).toBe("ABCD1234");
  });

  it("explains which rule failed", () => {
    const result = validateProjectKey("a-b");
    expect(Result.isFailure(result) && result.failure.message).toBe(
      'The project key "A-B" can only contain letters and numbers.',
    );
  });
});

describe("suggestProjectKey", () => {
  it("first tries a longer prefix of the name", () => {
    expect(suggestProjectKey("Kaneo Mobile", "KM", ["KM", "kan"])).toBe("KANE");
  });

  it("falls back to a numbered key", () => {
    expect(suggestProjectKey("Kaneo", "KAN", ["KAN", "KANE"])).toBe("KAN2");
    expect(suggestProjectKey("Kaneo", "KAN", ["kan", "kane", "kan2"])).toBe(
      "KAN3",
    );
  });

  it("stays within eight characters", () => {
    expect(
      suggestProjectKey("Abcdefgh", "ABCDEFGH", ["ABCDEFGH", "ABCD"]),
    ).toBe("ABCDEFG2");
  });
});
