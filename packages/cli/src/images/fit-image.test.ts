import { describe, expect, it } from "vite-plus/test";
import {
  BLOCK_CELL,
  fitImage,
  GRAPHICS_CELL,
  imageColumns,
} from "./fit-image.js";

const limits = { maxColumns: 64, maxRows: 20 };

describe("imageColumns", () => {
  it("caps the width at 64 columns and the space after the indent", () => {
    expect(imageColumns(200, 2)).toBe(64);
    expect(imageColumns(40, 4)).toBe(36);
    expect(imageColumns(1, 4)).toBe(1);
  });
});

describe("fitImage", () => {
  it("keeps the aspect ratio with cells twice as tall as wide", () => {
    expect(
      fitImage({ width: 1600, height: 800 }, { ...limits, ...GRAPHICS_CELL }),
    ).toEqual({ columns: 64, rows: 16 });
  });

  it("stops tall images at the row limit", () => {
    expect(
      fitImage({ width: 800, height: 1600 }, { ...limits, ...GRAPHICS_CELL }),
    ).toEqual({ columns: 20, rows: 20 });
  });

  it("never scales small images up beyond their pixels in blocks", () => {
    expect(
      fitImage({ width: 4, height: 4 }, { ...limits, ...BLOCK_CELL }),
    ).toEqual({ columns: 4, rows: 2 });
    expect(
      fitImage({ width: 1, height: 1 }, { ...limits, ...BLOCK_CELL }),
    ).toEqual({ columns: 1, rows: 1 });
  });

  it("scales small images up to the limits when asked", () => {
    expect(
      fitImage(
        { width: 32, height: 32 },
        { maxColumns: 16, maxRows: 8, ...GRAPHICS_CELL, upscale: true },
      ),
    ).toEqual({ columns: 16, rows: 8 });
  });

  it("treats graphics cells as about 8 by 16 pixels", () => {
    expect(
      fitImage({ width: 80, height: 80 }, { ...limits, ...GRAPHICS_CELL }),
    ).toEqual({ columns: 10, rows: 5 });
  });
});
