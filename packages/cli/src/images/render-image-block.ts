import type { Ui } from "../render/ui.js";
import type { ImageRef } from "./extract-images.js";
import type { ImageArt } from "./image-art.js";
import { renderCaption, renderPlaceholder } from "./placeholder.js";

export function renderImageBlock(
  ui: Ui,
  image: ImageRef,
  art: ImageArt,
  indent: number,
): string[] {
  const pad = " ".repeat(indent);
  const width = ui.caps.columns - indent;
  if (art._tag === "Unsupported") {
    return [`${pad}${renderPlaceholder(ui, image, width, art.reason)}`];
  }
  return [
    ...art.lines.map((line) => `${pad}${line}`),
    `${pad}${renderCaption(ui, image, width)}`,
  ];
}
