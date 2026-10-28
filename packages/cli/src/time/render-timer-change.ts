import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";

export type TimerChange = {
  readonly verb: "Started" | "Stopped" | "Logged" | "Updated";
  readonly label: string;
  readonly url: string;
  readonly details: ReadonlyArray<string>;
};

export function renderTimerChange(ui: Ui, change: TimerChange): string[] {
  const { theme, glyphs } = ui;
  const separator = ` ${theme.muted(glyphs.separator)} `;
  const label = renderCell([text(change.label, theme.strong, change.url)], ui);
  const details = change.details.filter((detail) => detail !== "");
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${change.verb} ${[label, ...details].join(separator)}`,
    "",
  ];
}
