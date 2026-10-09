import { hyperlink } from "./link.js";
import { sanitizeText } from "./sanitize.js";
import type { Style } from "./theme.js";
import type { Ui } from "./ui.js";
import { stringWidth, truncate } from "./width.js";

export type Segment = {
  readonly text: string;
  readonly style?: Style | undefined;
  readonly href?: string | undefined;
};

export type Cell = ReadonlyArray<Segment>;

export function text(value: string, style?: Style, href?: string): Segment {
  return { text: value, style, href };
}

export function cellWidth(cell: Cell): number {
  return cell.reduce((width, segment) => width + stringWidth(segment.text), 0);
}

export function fitCell(cell: Cell, width: number, ellipsis: string): Cell {
  if (cellWidth(cell) <= width) return cell;
  const fitted: Segment[] = [];
  let remaining = width;
  for (const segment of cell) {
    const segmentWidth = stringWidth(segment.text);
    if (segmentWidth < remaining) {
      fitted.push(segment);
      remaining -= segmentWidth;
      continue;
    }
    fitted.push({
      ...segment,
      text: truncate(segment.text, remaining, ellipsis),
    });
    break;
  }
  return fitted;
}

export function renderCell(cell: Cell, ui: Ui): string {
  return cell
    .map((segment) => {
      const clean = sanitizeText(segment.text);
      const styled = segment.style ? segment.style(clean) : clean;
      return segment.href
        ? hyperlink(styled, segment.href, ui.caps.hyperlinks)
        : styled;
    })
    .join("");
}
