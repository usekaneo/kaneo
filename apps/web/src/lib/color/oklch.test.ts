import { describe, expect, it } from "vite-plus/test";
import { contrastRatio, parseOklch } from "./oklch";

describe("contrastRatio", () => {
  it("measures opaque colors", () => {
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 1);
  });

  it("refuses translucent colors instead of guessing a backdrop", () => {
    expect(contrastRatio("oklch(0.2 0 0 / 0.5)", "oklch(1 0 0)")).toBeNull();
  });

  it("refuses non-oklch values", () => {
    expect(contrastRatio("#000", "oklch(1 0 0)")).toBeNull();
  });
});

describe("parseOklch", () => {
  it("reads alpha, including percentages", () => {
    expect(parseOklch("oklch(0.5 0.1 275 / 0.04)")?.alpha).toBe(0.04);
    expect(parseOklch("oklch(0.5 0.1 275 / 4%)")?.alpha).toBe(0.04);
  });
});
