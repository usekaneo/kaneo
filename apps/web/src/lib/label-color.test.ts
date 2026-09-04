import { describe, expect, it } from "vitest";
import { FALLBACK_LABEL_COLOR, resolveLabelColor } from "./label-color";

describe("resolveLabelColor", () => {
  it("maps Kaneo's named label colors to their CSS variables", () => {
    expect(resolveLabelColor("red")).toBe("var(--color-red-600)");
  });

  it("preserves custom hex colors imported from external systems", () => {
    expect(resolveLabelColor("#e83855")).toBe("#e83855");
    expect(resolveLabelColor("#ABC")).toBe("#ABC");
  });

  it("uses the neutral fallback for invalid colors", () => {
    expect(resolveLabelColor("not a color")).toBe(FALLBACK_LABEL_COLOR);
  });
});
