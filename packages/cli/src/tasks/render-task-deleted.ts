import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";

export function renderTaskDeleted(
  ui: Ui,
  deleted: { readonly label: string; readonly title: string },
): string[] {
  const { theme, glyphs } = ui;
  return [
    "",
    `  ${theme.success(glyphs.tick)} Deleted ${renderCell([text(deleted.label, theme.strong)], ui)} ${theme.muted(glyphs.separator)} ${deleted.title}`,
    "",
  ];
}
