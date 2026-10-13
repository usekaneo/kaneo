import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { truncate } from "../render/width.js";
import type { ImageRef } from "./extract-images.js";

export function renderPlaceholder(
  ui: Ui,
  image: ImageRef,
  width: number,
  reason?: string,
): string {
  const { theme, glyphs } = ui;
  const label = truncate(
    image.alt ? `[image: ${image.alt}]` : "[image]",
    Math.max(8, width),
    glyphs.ellipsis,
  );
  const link = renderCell([text(label, theme.muted, image.url)], ui);
  return reason
    ? `${link} ${theme.muted(`${glyphs.separator} ${reason}`)}`
    : link;
}

export function renderCaption(ui: Ui, image: ImageRef, width: number): string {
  const caption = truncate(
    image.alt || "Image",
    Math.max(8, width),
    ui.glyphs.ellipsis,
  );
  return renderCell([text(caption, ui.theme.muted, image.url)], ui);
}
