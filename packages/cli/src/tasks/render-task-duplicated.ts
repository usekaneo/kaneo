import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type TaskDuplicated = {
  readonly sourceLabel: string;
  readonly label: string;
  readonly url: string;
  readonly title: string;
};

export function renderTaskDuplicated(ui: Ui, copy: TaskDuplicated): string[] {
  const { theme, glyphs } = ui;
  const reference = renderCell([text(copy.label, theme.strong, copy.url)], ui);
  const head = `  ${theme.success(glyphs.tick)} Duplicated ${theme.muted(copy.sourceLabel)} ${theme.muted(glyphs.arrow)} ${reference} ${theme.muted(glyphs.separator)} `;
  const title = truncate(
    copy.title,
    Math.max(ui.caps.columns - stringWidth(head), 8),
    glyphs.ellipsis,
  );
  return ["", `${head}${title}`, ""];
}
