import { describe, expect, it } from "vite-plus/test";
import { box } from "./box.js";
import { makeUi } from "./ui.js";
import { stringWidth } from "./width.js";

const make = (unicode: boolean, columns = 80) =>
  makeUi({ color: 0, unicode, hyperlinks: false, animate: false, columns });

describe("box", () => {
  it("draws a rounded box with a title and equal line widths", () => {
    const lines = box(make(true), ["one", "two words"], { title: "Sign in" });
    expect(lines[0]?.startsWith("╭─ Sign in ")).toBe(true);
    expect(lines.at(-1)?.startsWith("╰")).toBe(true);
    const widths = new Set(lines.map(stringWidth));
    expect(widths.size).toBe(1);
  });

  it("falls back to ascii borders", () => {
    const lines = box(make(false), ["x"]);
    expect(lines[0]?.startsWith("+-")).toBe(true);
    expect(lines[1]?.startsWith("|")).toBe(true);
  });

  it("fits the terminal width", () => {
    const lines = box(make(true, 20), [
      "a very long line that does not fit in twenty columns",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(20);
  });
});
