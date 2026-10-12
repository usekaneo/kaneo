import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";

export type TaskChange = {
  readonly verb: "Created" | "Updated";
  readonly reference: string;
  readonly url: string;
  readonly detail: string;
};

export function renderTaskChange(ui: Ui, change: TaskChange): string[] {
  const { theme, glyphs } = ui;
  const reference = renderCell(
    [text(change.reference, theme.strong, change.url)],
    ui,
  );
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${change.verb} ${reference} ${theme.muted(glyphs.separator)} ${change.detail}`,
    "",
  ];
}
