import { labelColorHex } from "../labels/label-colors.js";
import type { ColorLevel } from "./capabilities.js";
import type { Segment } from "./cell.js";
import type { Style } from "./theme.js";
import type { Ui } from "./ui.js";

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function nearest256([r, g, b]: Rgb): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  const level = (value: number) => Math.round((value / 255) * 5);
  return 16 + 36 * level(r) + 6 * level(g) + level(b);
}

export function labelStyle(level: ColorLevel, color: string): Style {
  if (level < 2) return (text) => text;
  const rgb = hexToRgb(labelColorHex(color));
  const open =
    level === 3
      ? `\u001b[38;2;${rgb.join(";")}m`
      : `\u001b[38;5;${nearest256(rgb)}m`;
  return (text) => (text ? `${open}${text}\u001b[39m` : text);
}

export function labelChipSegment(ui: Ui, color: string): Segment {
  return { text: ui.glyphs.dot, style: labelStyle(ui.caps.color, color) };
}

export function labelChip(ui: Ui, color: string): string {
  return labelStyle(ui.caps.color, color)(ui.glyphs.dot);
}
