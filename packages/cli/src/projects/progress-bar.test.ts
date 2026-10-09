import { describe, expect, it } from "vite-plus/test";
import { renderCell } from "../render/cell.js";
import { makeUi } from "../render/ui.js";
import { barSegments, progressSegments } from "./progress-bar.js";

const unicode = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});
const ascii = makeUi({
  color: 0,
  unicode: false,
  hyperlinks: false,
  animate: false,
  columns: 80,
});
const colored = makeUi({
  color: 1,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const bar = (ratio: number, width = 10) =>
  renderCell(barSegments(unicode, ratio, width), unicode);

describe("barSegments", () => {
  it("fills in proportion to the ratio", () => {
    expect(bar(0)).toBe("▱▱▱▱▱▱▱▱▱▱");
    expect(bar(0.5)).toBe("▰▰▰▰▰▱▱▱▱▱");
    expect(bar(1)).toBe("▰▰▰▰▰▰▰▰▰▰");
  });

  it("shows any progress at all and keeps a gap until it is complete", () => {
    expect(bar(0.01)).toBe("▰▱▱▱▱▱▱▱▱▱");
    expect(bar(0.99)).toBe("▰▰▰▰▰▰▰▰▰▱");
  });

  it("clamps odd input", () => {
    expect(bar(-1)).toBe("▱▱▱▱▱▱▱▱▱▱");
    expect(bar(3)).toBe("▰▰▰▰▰▰▰▰▰▰");
    expect(bar(Number.NaN)).toBe("▱▱▱▱▱▱▱▱▱▱");
    expect(bar(0.5, 0)).toBe("");
  });

  it("falls back to ASCII", () => {
    expect(renderCell(barSegments(ascii, 0.3, 10), ascii)).toBe("###-------");
  });
});

describe("progressSegments", () => {
  it("adds an aligned percentage", () => {
    expect(renderCell(progressSegments(unicode, 14), unicode)).toBe(
      "▰▱▱▱▱▱▱▱▱▱  14%",
    );
    expect(renderCell(progressSegments(unicode, 100), unicode)).toBe(
      "▰▰▰▰▰▰▰▰▰▰ 100%",
    );
  });

  it("uses the success color only when complete", () => {
    const done = renderCell(progressSegments(colored, 100), colored);
    const partial = renderCell(progressSegments(colored, 50), colored);
    expect(done).toContain("\u001b[32m▰▰▰▰▰▰▰▰▰▰");
    expect(partial).not.toContain("\u001b[32m");
  });
});
