import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { fieldTypeLabel } from "./field-types.js";

export function renderFieldChange(
  ui: Ui,
  change: {
    readonly verb: "Created" | "Deleted";
    readonly name: string;
    readonly type: string;
  },
): string[] {
  const { theme, glyphs } = ui;
  const detail =
    change.verb === "Created"
      ? fieldTypeLabel(change.type)
      : "its values are gone from every task";
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${change.verb} the field ${theme.strong(change.name)} ${theme.muted(`${glyphs.separator} ${detail}`)}`,
    "",
  ];
}

export function renderFieldValueChange(
  ui: Ui,
  change: {
    readonly label: string;
    readonly url: string;
    readonly field: string;
    readonly value: string | null;
  },
): string[] {
  const { theme, glyphs } = ui;
  const id = renderCell([text(change.label, theme.strong, change.url)], ui);
  const outcome =
    change.value === null ? "cleared" : `set to ${theme.strong(change.value)}`;
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${id} ${theme.muted(glyphs.separator)} ${change.field} ${outcome}`,
    "",
  ];
}
