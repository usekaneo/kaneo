import type { ColorLevel } from "./capabilities.js";

export type Style = (text: string) => string;

type Rgb = readonly [number, number, number];

type Swatch = { readonly rgb: Rgb; readonly ansi16: number };

const swatches = {
  neutral: { rgb: [115, 115, 115], ansi16: 90 },
  slate: { rgb: [100, 116, 139], ansi16: 90 },
  blue: { rgb: [59, 130, 246], ansi16: 34 },
  amber: { rgb: [217, 119, 6], ansi16: 33 },
  emerald: { rgb: [5, 150, 105], ansi16: 32 },
  red: { rgb: [239, 68, 68], ansi16: 31 },
} satisfies Record<string, Swatch>;

export type Theme = {
  readonly level: ColorLevel;
  readonly accent: Style;
  readonly strong: Style;
  readonly muted: Style;
  readonly border: Style;
  readonly success: Style;
  readonly warning: Style;
  readonly danger: Style;
  readonly info: Style;
  readonly todo: Style;
  readonly progress: Style;
  readonly review: Style;
  readonly done: Style;
};

const identity: Style = (text) => text;

function rgbTo256([r, g, b]: Rgb): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  const level = (value: number) => Math.round((value / 255) * 5);
  return 16 + 36 * level(r) + 6 * level(g) + level(b);
}

function openCode(swatch: Swatch, level: ColorLevel): string {
  if (level === 0) return "";
  if (level === 3) return `\u001b[38;2;${swatch.rgb.join(";")}m`;
  if (level === 2) return `\u001b[38;5;${rgbTo256(swatch.rgb)}m`;
  return `\u001b[${swatch.ansi16}m`;
}

function foreground(swatch: Swatch, level: ColorLevel): Style {
  if (level === 0) return identity;
  const open = openCode(swatch, level);
  return (text) => (text ? `${open}${text}\u001b[39m` : text);
}

export type ThemeCodes = {
  readonly bold: string;
  readonly muted: string;
  readonly success: string;
  readonly danger: string;
};

export function themeCodes(level: ColorLevel): ThemeCodes {
  return {
    bold: level === 0 ? "" : "\u001b[1m",
    muted: openCode(swatches.neutral, level),
    success: openCode(swatches.emerald, level),
    danger: openCode(swatches.red, level),
  };
}

function bold(level: ColorLevel): Style {
  if (level === 0) return identity;
  return (text) => (text ? `\u001b[1m${text}\u001b[22m` : text);
}

export function makeTheme(level: ColorLevel): Theme {
  return {
    level,
    accent: bold(level),
    strong: bold(level),
    muted: foreground(swatches.neutral, level),
    border: foreground(swatches.neutral, level),
    success: foreground(swatches.emerald, level),
    warning: foreground(swatches.amber, level),
    danger: foreground(swatches.red, level),
    info: foreground(swatches.blue, level),
    todo: foreground(swatches.slate, level),
    progress: foreground(swatches.blue, level),
    review: foreground(swatches.amber, level),
    done: foreground(swatches.emerald, level),
  };
}
