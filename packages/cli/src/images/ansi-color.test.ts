import { describe, expect, it } from "vite-plus/test";
import { colorParameters, nearest256 } from "./ansi-color.js";

describe("nearest256", () => {
  it("maps primaries onto the color cube", () => {
    expect(nearest256([255, 0, 0])).toBe(196);
    expect(nearest256([0, 0, 0])).toBe(16);
    expect(nearest256([255, 255, 255])).toBe(231);
    expect(nearest256([95, 135, 175])).toBe(67);
  });

  it("uses the gray ramp for grays between cube steps", () => {
    expect(nearest256([118, 118, 118])).toBe(243);
    expect(nearest256([238, 238, 238])).toBe(255);
  });
});

describe("colorParameters", () => {
  it("writes truecolor and 256 color parameters", () => {
    expect(colorParameters("foreground", [1, 2, 3], 3)).toBe("38;2;1;2;3");
    expect(colorParameters("background", [255, 0, 0], 2)).toBe("48;5;196");
  });
});
