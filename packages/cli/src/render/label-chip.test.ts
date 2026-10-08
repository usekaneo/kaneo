import { describe, expect, it } from "vite-plus/test";
import type { ColorLevel } from "./capabilities.js";
import { labelChip, labelChipSegment, nearest256 } from "./label-chip.js";
import { makeUi } from "./ui.js";

const ui = (color: ColorLevel, unicode = true) =>
  makeUi({ color, unicode, hyperlinks: false, animate: false, columns: 80 });

describe("labelChip", () => {
  it("prints a plain dot without color support", () => {
    expect(labelChip(ui(0), "red")).toBe("●");
    expect(labelChip(ui(1), "#ff6600")).toBe("●");
  });

  it("uses the nearest 256 color at level 2", () => {
    expect(labelChip(ui(2), "#ff6600")).toBe("\u001b[38;5;208m●\u001b[39m");
    expect(labelChip(ui(2), "#808080")).toBe("\u001b[38;5;244m●\u001b[39m");
  });

  it("uses the exact color at truecolor", () => {
    expect(labelChip(ui(3), "#ff6600")).toBe(
      "\u001b[38;2;255;102;0m●\u001b[39m",
    );
    expect(labelChip(ui(3), "red")).toBe("\u001b[38;2;231;0;11m●\u001b[39m");
  });

  it("falls back to ascii and a neutral color", () => {
    expect(labelChip(ui(0, false), "red")).toBe("*");
    expect(labelChip(ui(3), "nonsense")).toBe(
      "\u001b[38;2;161;161;161m●\u001b[39m",
    );
  });

  it("exposes a table segment", () => {
    const segment = labelChipSegment(ui(3), "#ff6600");
    expect(segment.text).toBe("●");
    expect(segment.style?.("x")).toBe("\u001b[38;2;255;102;0mx\u001b[39m");
  });
});

describe("nearest256", () => {
  it("maps grays to the gray ramp and colors to the cube", () => {
    expect(nearest256([0, 0, 0])).toBe(16);
    expect(nearest256([255, 255, 255])).toBe(231);
    expect(nearest256([255, 0, 0])).toBe(196);
  });
});
