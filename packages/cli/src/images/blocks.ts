import { colorParameters } from "./ansi-color.js";
import type { CellSize } from "./cell-size.js";
import { resizeRgba } from "./resize-rgba.js";
import type { Rgb, RgbaImage } from "./rgba.js";

export type BlockOptions = CellSize & {
  readonly level: 2 | 3;
  readonly background: Rgb | null;
};

type Pen = { foreground: string | null; background: string | null };

const UPPER_HALF = "▀";
const LOWER_HALF = "▄";

function mix(color: number, background: number, alpha: number): number {
  return Math.round(color * alpha + background * (1 - alpha));
}

export function compositePixel(
  data: Uint8Array,
  at: number,
  background: Rgb | null,
): Rgb | null {
  const alpha = data[at + 3] ?? 0;
  if (alpha === 0) return null;
  const rgb: Rgb = [data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0];
  if (alpha === 255) return rgb;
  if (background === null) return alpha >= 128 ? rgb : null;
  const weight = alpha / 255;
  return [
    mix(rgb[0], background[0], weight),
    mix(rgb[1], background[1], weight),
    mix(rgb[2], background[2], weight),
  ];
}

function switchPen(pen: Pen, next: Pen): string {
  const parameters: string[] = [];
  if (next.foreground !== pen.foreground) {
    parameters.push(next.foreground ?? "39");
  }
  if (next.background !== pen.background) {
    parameters.push(next.background ?? "49");
  }
  pen.foreground = next.foreground;
  pen.background = next.background;
  return parameters.length > 0 ? `\u001b[${parameters.join(";")}m` : "";
}

function cell(
  top: Rgb | null,
  bottom: Rgb | null,
  pen: Pen,
  level: 2 | 3,
): { readonly pen: Pen; readonly glyph: string } {
  if (top && bottom) {
    return {
      pen: {
        foreground: colorParameters("foreground", top, level),
        background: colorParameters("background", bottom, level),
      },
      glyph: UPPER_HALF,
    };
  }
  if (top || bottom) {
    return {
      pen: {
        foreground: colorParameters(
          "foreground",
          (top ?? bottom) as Rgb,
          level,
        ),
        background: null,
      },
      glyph: top ? UPPER_HALF : LOWER_HALF,
    };
  }
  return { pen: { foreground: pen.foreground, background: null }, glyph: " " };
}

export function renderBlocks(
  image: RgbaImage,
  options: BlockOptions,
): string[] {
  const scaled = resizeRgba(image, options.columns, options.rows * 2);
  const pixel = (x: number, y: number) =>
    y < scaled.height
      ? compositePixel(
          scaled.data,
          (y * scaled.width + x) * 4,
          options.background,
        )
      : null;
  const lines: string[] = [];
  for (let row = 0; row < options.rows; row++) {
    const pen: Pen = { foreground: null, background: null };
    let line = "";
    for (let x = 0; x < scaled.width; x++) {
      const next = cell(
        pixel(x, row * 2),
        pixel(x, row * 2 + 1),
        pen,
        options.level,
      );
      line += switchPen(pen, next.pen) + next.glyph;
    }
    if (pen.foreground !== null || pen.background !== null) {
      line += "\u001b[39;49m";
    }
    lines.push(line);
  }
  return lines;
}
