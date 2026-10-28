import type { Ui } from "./ui.js";
import { padEnd, stringWidth, truncate } from "./width.js";

export type BoxOptions = {
  readonly title?: string;
  readonly paddingX?: number;
  readonly paddingY?: number;
  readonly minWidth?: number;
};

export function box(
  ui: Ui,
  lines: ReadonlyArray<string>,
  options: BoxOptions = {},
): string[] {
  const { box: chars, ellipsis } = ui.glyphs;
  const paddingX = options.paddingX ?? 2;
  const paddingY = options.paddingY ?? 0;
  const border = ui.theme.border;
  const title = options.title ? ` ${options.title} ` : "";
  const maxInner = Math.max(4, ui.caps.columns - 2);
  const contentWidth = Math.max(
    options.minWidth ?? 0,
    stringWidth(title) + 2 - paddingX * 2,
    ...lines.map((line) => stringWidth(line)),
  );
  const inner = Math.min(maxInner, contentWidth + paddingX * 2);
  const usable = inner - paddingX * 2;
  const pad = " ".repeat(paddingX);
  const blank =
    border(chars.vertical) + " ".repeat(inner) + border(chars.vertical);
  const fittedTitle = title ? truncate(title, inner - 2, ellipsis) : "";
  const top =
    border(chars.topLeft + chars.horizontal) +
    (fittedTitle ? ui.theme.strong(fittedTitle) : "") +
    border(
      chars.horizontal.repeat(
        Math.max(0, inner - 1 - stringWidth(fittedTitle)),
      ) + chars.topRight,
    );
  const body = lines.map((line) => {
    const fitted =
      stringWidth(line) > usable ? truncate(line, usable, ellipsis) : line;
    return (
      border(chars.vertical) +
      pad +
      padEnd(fitted, usable) +
      pad +
      border(chars.vertical)
    );
  });
  const spacer = Array.from({ length: paddingY }, () => blank);
  const bottom = border(
    chars.bottomLeft + chars.horizontal.repeat(inner) + chars.bottomRight,
  );
  return [top, ...spacer, ...body, ...spacer, bottom];
}
