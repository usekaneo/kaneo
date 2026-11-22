import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { readTokenBlock } from "./css-tokens";
import { contrastRatio, parseOklch } from "./oklch";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const light = readTokenBlock(css, ':root[data-palette="modern"]');
const dark = readTokenBlock(css, ':root.dark[data-palette="modern"]');

const TEXT_PAIRS = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["info-foreground", "background"],
  ["success-foreground", "background"],
  ["warning-foreground", "background"],
  ["destructive-foreground", "background"],
  ["board-title", "board-card"],
  ["chip-foreground", "background"],
] as const;
const ACCENT_TOKENS = [
  "primary",
  "ring",
  "sidebar-primary",
  "sidebar-ring",
] as const;
const NON_TEXT_PAIRS = [
  ["ring", "background"],
  ["board-card-focus", "board-card"],
  ["priority-low", "background"],
  ["priority-medium", "background"],
  ["priority-high", "background"],
  ["priority-urgent", "background"],
] as const;

describe.each([
  ["light", light],
  ["dark", dark],
])("modern %s accent", (_name, tokens) => {
  it.each(ACCENT_TOKENS)("%s keeps an accent hue", (name) => {
    const parsed = parseOklch(tokens.get(`--${name}`)!);
    expect(parsed, `${name} must be oklch`).not.toBeNull();
    expect(parsed!.c, `${name} chroma`).toBeGreaterThanOrEqual(0.12);
    expect(Math.abs(parsed!.h - 275), `${name} hue`).toBeLessThanOrEqual(10);
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
])("modern %s contrast", (_name, tokens) => {
  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    const ratio = contrastRatio(tokens.get(`--${fg}`)!, tokens.get(`--${bg}`)!);
    expect(ratio, `${fg}/${bg} = ${ratio}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each(NON_TEXT_PAIRS)("%s on %s meets 3:1", (fg, bg) => {
    const ratio = contrastRatio(tokens.get(`--${fg}`)!, tokens.get(`--${bg}`)!);
    expect(ratio, `${fg}/${bg} = ${ratio}`).toBeGreaterThanOrEqual(3);
  });
});
