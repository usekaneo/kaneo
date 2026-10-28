import { describe, expect, it } from "vite-plus/test";
import { kaneoColorToHex } from "./colors.js";

describe("kaneoColorToHex", () => {
  it("maps Kaneo palette names to hex", () => {
    expect(kaneoColorToHex("purple")).toBe("#8b5cf6");
    expect(kaneoColorToHex("dark-gray")).toBe("#64748b");
    expect(kaneoColorToHex("Red")).toBe("#dc2626");
  });

  it("normalizes hex values", () => {
    expect(kaneoColorToHex("#ABCDEF")).toBe("#abcdef");
    expect(kaneoColorToHex("#abc")).toBe("#aabbcc");
    expect(kaneoColorToHex("#abcd")).toBe("#aabbcc");
    expect(kaneoColorToHex("#11223344")).toBe("#112233");
  });

  it("falls back to gray for unknown values", () => {
    expect(kaneoColorToHex("var(--color-sky-500)")).toBe("#6b7280");
    expect(kaneoColorToHex("")).toBe("#6b7280");
    expect(kaneoColorToHex(null)).toBe("#6b7280");
  });
});
