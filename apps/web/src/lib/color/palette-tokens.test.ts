import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { readTokenBlock } from "./css-tokens";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const NON_COLOR = /^--(font|radius|ease|animate)/;

function colorTokens(selector: string) {
  return [...readTokenBlock(css, selector).keys()].filter(
    (name) => !NON_COLOR.test(name),
  );
}

describe("modern palette token coverage", () => {
  it("overrides every base color token in light mode", () => {
    const base = colorTokens(":root");
    const modern = new Set(colorTokens(':root[data-palette="modern"]'));
    expect(base.filter((name) => !modern.has(name))).toEqual([]);
  });

  it("overrides every light palette token in dark mode", () => {
    const light = colorTokens(':root[data-palette="modern"]');
    const dark = new Set(colorTokens(':root.dark[data-palette="modern"]'));
    expect(light.filter((name) => !dark.has(name))).toEqual([]);
  });

  it("overrides every base dark token", () => {
    const base = colorTokens(".dark");
    const modern = new Set(colorTokens(':root.dark[data-palette="modern"]'));
    expect(base.filter((name) => !modern.has(name))).toEqual([]);
  });
});
