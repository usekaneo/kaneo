import { describe, expect, it } from "vite-plus/test";
import {
  normalizeLabel,
  normalizeLabels,
} from "../../../../apps/api/src/contact/options/normalize-labels";

describe("normalizeLabels", () => {
  it("trims, collapses spaces, and drops blanks", () => {
    expect(
      normalizeLabels(["  Maafushi ", "", "   ", "K.  Guraidhoo"]),
    ).toEqual({
      labels: ["Maafushi", "K. Guraidhoo"],
      repeated: [],
    });
  });

  it("removes repeats ignoring case, keeping the first spelling", () => {
    expect(
      normalizeLabels(["Thulusdhoo", "thulusdhoo", "THULUSDHOO", "Gulhi"]),
    ).toEqual({
      labels: ["Thulusdhoo", "Gulhi"],
      repeated: ["thulusdhoo", "THULUSDHOO"],
    });
  });

  it("treats composed and decomposed accents as the same name", () => {
    const decomposed = "Malé";
    expect(normalizeLabel(decomposed)).toBe("Malé");
    expect(normalizeLabels(["Malé", decomposed]).labels).toEqual(["Malé"]);
  });
});
