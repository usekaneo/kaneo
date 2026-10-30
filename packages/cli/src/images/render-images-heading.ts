import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type ImagesHeading = {
  readonly label: string;
  readonly title: string;
  readonly url: string;
  readonly count: number;
};

export function renderImagesHeading(ui: Ui, heading: ImagesHeading): string[] {
  const { theme, glyphs } = ui;
  const id = renderCell([text(heading.label, theme.muted, heading.url)], ui);
  const count =
    heading.count === 0
      ? ""
      : ` ${glyphs.separator} ${heading.count} ${heading.count === 1 ? "image" : "images"}`;
  const room = Math.max(
    8,
    ui.caps.columns - 2 - stringWidth(heading.label) - 1 - stringWidth(count),
  );
  const title = theme.strong(truncate(heading.title, room, glyphs.ellipsis));
  const line = `  ${id} ${title}${theme.muted(count)}`;
  if (heading.count > 0) return ["", line, ""];
  return ["", line, "", `  ${theme.muted("No images in this task.")}`, ""];
}
