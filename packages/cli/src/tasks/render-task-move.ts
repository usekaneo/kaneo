import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type TaskMove = {
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly title: string;
  readonly url: string;
};

export function renderTaskMove(ui: Ui, move: TaskMove): string[] {
  const { theme, glyphs } = ui;
  const to = renderCell([text(move.toLabel, theme.strong, move.url)], ui);
  const head = `  ${theme.success(glyphs.tick)} Moved ${theme.muted(move.fromLabel)} ${theme.muted(glyphs.arrow)} ${to} ${theme.muted(glyphs.separator)} `;
  const title = truncate(
    move.title,
    Math.max(ui.caps.columns - stringWidth(head), 8),
    glyphs.ellipsis,
  );
  return ["", `${head}${title}`, ""];
}
