import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { truncate } from "../render/width.js";
import type { ImageRef } from "./extract-images.js";

export function moreImagesLine(ui: Ui, hidden: number): string {
  return ui.theme.muted(
    `${hidden} more ${hidden === 1 ? "image" : "images"} not shown`,
  );
}

export function renderImageLinks(
  ui: Ui,
  images: ReadonlyArray<ImageRef>,
  options: { readonly indent: number; readonly hidden: number },
): string[] {
  const { theme, glyphs } = ui;
  const pad = " ".repeat(options.indent);
  const numberWidth = `${images.length}.`.length;
  const hang = " ".repeat(numberWidth + 1);
  const width = Math.max(8, ui.caps.columns - options.indent - hang.length);
  const lines = images.flatMap((image, index) => [
    `${pad}${theme.muted(`${index + 1}.`.padStart(numberWidth))} ${truncate(image.alt || "Image", width, glyphs.ellipsis)}`,
    `${pad}${hang}${renderCell([text(image.url, theme.info, image.url)], ui)}`,
  ]);
  if (options.hidden > 0)
    lines.push(`${pad}${moreImagesLine(ui, options.hidden)}`);
  return [...lines, ""];
}
