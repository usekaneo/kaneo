import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type TaskHeading = {
  readonly label: string;
  readonly title: string;
  readonly url: string;
  readonly meta?: string;
};

export function renderTaskHeading(ui: Ui, heading: TaskHeading): string {
  const { theme, glyphs } = ui;
  const id = renderCell([text(heading.label, theme.muted, heading.url)], ui);
  const meta = heading.meta ? ` ${glyphs.separator} ${heading.meta}` : "";
  const room =
    ui.caps.columns - 3 - stringWidth(heading.label) - stringWidth(meta);
  const title = truncate(heading.title, Math.max(room, 8), glyphs.ellipsis);
  return `  ${id} ${theme.strong(title)}${theme.muted(meta)}`;
}
