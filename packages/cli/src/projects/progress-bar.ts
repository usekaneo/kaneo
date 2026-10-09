import type { Segment } from "../render/cell.js";
import type { Style } from "../render/theme.js";
import type { Ui } from "../render/ui.js";

function clampRatio(ratio: number): number {
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
}

export function barSegments(
  ui: Ui,
  ratio: number,
  width: number,
  style?: Style,
): Segment[] {
  if (width <= 0) return [];
  const value = clampRatio(ratio);
  let filled = Math.round(value * width);
  if (value > 0 && filled === 0) filled = 1;
  if (value < 1 && filled === width) filled = width - 1;
  const [on, off] = ui.caps.unicode ? ["▰", "▱"] : ["#", "-"];
  const segments: Segment[] = [];
  if (filled > 0) segments.push({ text: on.repeat(filled), style });
  if (filled < width)
    segments.push({ text: off.repeat(width - filled), style: ui.theme.muted });
  return segments;
}

export function progressSegments(
  ui: Ui,
  percent: number,
  width = 10,
): Segment[] {
  const value = Math.round(clampRatio(percent / 100) * 100);
  const complete = value === 100;
  return [
    ...barSegments(
      ui,
      value / 100,
      width,
      complete ? ui.theme.success : ui.theme.info,
    ),
    {
      text: ` ${String(value).padStart(3)}%`,
      style: complete ? ui.theme.success : undefined,
    },
  ];
}
