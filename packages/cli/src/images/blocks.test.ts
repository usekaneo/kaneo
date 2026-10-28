import { describe, expect, it } from "vite-plus/test";
import { compositePixel, renderBlocks } from "./blocks.js";

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 0, 0, 0];

function image(width: number, height: number, pixels: number[][]) {
  return { width, height, data: new Uint8Array(pixels.flat()) };
}

describe("renderBlocks", () => {
  it("draws two pixels per cell with the upper half block", () => {
    const lines = renderBlocks(image(2, 2, [RED, BLUE, BLUE, RED]), {
      columns: 2,
      rows: 1,
      level: 3,
      background: null,
    });
    expect(lines).toEqual([
      "\u001b[38;2;255;0;0;48;2;0;0;255m▀\u001b[38;2;0;0;255;48;2;255;0;0m▀\u001b[39;49m",
    ]);
  });

  it("uses the nearest 256 colors at level 2", () => {
    const lines = renderBlocks(image(1, 2, [RED, BLUE]), {
      columns: 1,
      rows: 1,
      level: 2,
      background: null,
    });
    expect(lines).toEqual(["\u001b[38;5;196;48;5;21m▀\u001b[39;49m"]);
  });

  it("leaves transparent pixels to the terminal background", () => {
    const lines = renderBlocks(
      image(3, 2, [CLEAR, RED, CLEAR, CLEAR, CLEAR, BLUE]),
      { columns: 3, rows: 1, level: 3, background: null },
    );
    expect(lines).toEqual([
      " \u001b[38;2;255;0;0m▀\u001b[38;2;0;0;255m▄\u001b[39;49m",
    ]);
  });

  it("only changes colors when the next cell needs different ones", () => {
    const lines = renderBlocks(image(2, 2, [RED, RED, BLUE, BLUE]), {
      columns: 2,
      rows: 1,
      level: 3,
      background: null,
    });
    expect(lines).toEqual(["\u001b[38;2;255;0;0;48;2;0;0;255m▀▀\u001b[39;49m"]);
  });

  it("scales the picture to the requested cells", () => {
    const pixels = Array.from({ length: 16 }, () => RED);
    const lines = renderBlocks(image(4, 4, pixels), {
      columns: 2,
      rows: 1,
      level: 3,
      background: null,
    });
    expect(lines).toEqual(["\u001b[38;2;255;0;0;48;2;255;0;0m▀▀\u001b[39;49m"]);
  });
});

describe("compositePixel", () => {
  const half = new Uint8Array([200, 100, 0, 128]);

  it("blends partial alpha over a known background", () => {
    expect(compositePixel(half, 0, [0, 0, 0])).toEqual([100, 50, 0]);
  });

  it("keeps mostly opaque pixels and drops mostly clear ones without one", () => {
    expect(compositePixel(half, 0, null)).toEqual([200, 100, 0]);
    expect(compositePixel(new Uint8Array([1, 2, 3, 100]), 0, null)).toBeNull();
    expect(
      compositePixel(new Uint8Array([1, 2, 3, 0]), 0, [9, 9, 9]),
    ).toBeNull();
  });
});
