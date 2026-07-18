import { describe, expect, it } from "vitest";
import { toSlug } from "../../../apps/api/src/column/controllers/create-column";

describe("toSlug", () => {
  it("slugifies Latin names", () => {
    expect(toSlug("To Do")).toBe("to-do");
    expect(toSlug("  In Progress!  ")).toBe("in-progress");
  });

  it("keeps non-Latin scripts instead of producing an empty slug", () => {
    expect(toSlug("тест")).toBe("тест");
    expect(toSlug("В работе")).toBe("в-работе");
    expect(toSlug("测试")).toBe("测试");
    expect(toSlug("قيد التنفيذ")).toBe("قيد-التنفيذ");
  });

  it("mixes scripts and numbers", () => {
    expect(toSlug("Спринт 2")).toBe("спринт-2");
  });

  it("folds full-width characters via NFKC normalization", () => {
    expect(toSlug("ＡＢＣ")).toBe("abc");
  });

  it("keeps combining marks attached to their base letters", () => {
    expect(toSlug("İzmir")).toBe("i̇zmir");
    expect(toSlug("हिन्दी")).toBe("हिन्दी");
  });

  it("returns an empty slug for names with no letters or numbers", () => {
    expect(toSlug("!!!")).toBe("");
    expect(toSlug("- - -")).toBe("");
  });
});
