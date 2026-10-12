import { labelChip } from "../render/label-chip.js";
import type { Ui } from "../render/ui.js";

export type LabelChange = {
  readonly verb: "Created" | "Updated" | "Deleted";
  readonly name: string;
  readonly color: string;
  readonly detail?: string;
};

export function renderLabelChange(ui: Ui, change: LabelChange): string[] {
  const { theme, glyphs } = ui;
  const detail = change.detail
    ? ` ${theme.muted(glyphs.separator)} ${change.detail}`
    : "";
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${change.verb} label ${labelChip(ui, change.color)} ${theme.strong(change.name)}${detail}`,
    "",
  ];
}
