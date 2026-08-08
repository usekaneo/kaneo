import { describe, expect, it } from "vitest";
import generateProjectSlug from "./generate-project-id";

describe("generateProjectSlug", () => {
  it("takes the first three letters of a single word", () => {
    expect(generateProjectSlug("Kaneo")).toBe("KAN");
  });

  it("takes the initials of the first three words", () => {
    expect(generateProjectSlug("Alpha Beta Gamma")).toBe("ABG");
    expect(generateProjectSlug("Alpha Beta Gamma Delta")).toBe("ABG");
  });

  it("ignores a leading separator instead of spending an initial on it", () => {
    expect(generateProjectSlug(" Kaneo")).toBe("KAN");
    expect(generateProjectSlug(" Alpha Beta Gamma")).toBe("ABG");
    expect(generateProjectSlug("- Alpha Beta Gamma")).toBe("ABG");
  });

  it("keeps non-Latin scripts instead of producing an empty key", () => {
    expect(generateProjectSlug("тест")).toBe("ТЕС");
    expect(generateProjectSlug("Проект Альфа")).toBe("ПА");
    expect(generateProjectSlug("测试项目")).toBe("测试项");
  });

  it("keeps digits and punctuation handling as they were", () => {
    expect(generateProjectSlug("Sprint 2")).toBe("S2");
    expect(generateProjectSlug("[Alpha] Beta Gamma")).toBe("ABG");
  });

  it("folds full-width characters via NFKC normalization", () => {
    expect(generateProjectSlug("ＡＢＣ")).toBe("ABC");
  });

  it("returns an empty key when the name has no letters or numbers", () => {
    expect(generateProjectSlug("!!!")).toBe("");
    expect(generateProjectSlug("   ")).toBe("");
  });
});
