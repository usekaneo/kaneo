import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_LABEL_COLOR, resolveLabelColor } from "./label-color";

afterEach(() => vi.unstubAllGlobals());

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

  it("preserves non-hex colors supported by the browser", () => {
    const color = "rgb(232 56 85)";
    const supports = vi.fn(() => true);
    vi.stubGlobal("CSS", { supports });

    const resolved = resolveLabelColor(color);

    expect(resolved).toBe(color);
    expect(supports).toHaveBeenCalledWith("color", color);
  });

  it("uses the fallback when the browser rejects a non-hex color", () => {
    vi.stubGlobal("CSS", { supports: () => false });

    const resolved = resolveLabelColor("not a color");

    expect(resolved).toBe(FALLBACK_LABEL_COLOR);
  });
});
