import { formatJsonValue } from "../fields/field-value.js";
import type { TaskFieldJson } from "../fields/render-task-fields.js";
import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import { sectionTitle } from "./section-title.js";

export function renderFields(
  ui: Ui,
  fields: ReadonlyArray<TaskFieldJson>,
): string[] {
  if (fields.length === 0) return [];
  return [
    sectionTitle(ui, "Custom fields"),
    ...renderTable(
      ui,
      fields,
      [
        {
          header: "Field",
          minWidth: 10,
          cell: (field): Cell => [text(field.name, ui.theme.muted)],
        },
        {
          header: "Value",
          flex: true,
          minWidth: 12,
          cell: (field): Cell => [
            text((formatJsonValue(field.value) ?? "").replace(/\s+/gu, " ")),
          ],
        },
      ],
      { width: ui.caps.columns, indent: 4, gap: 2 },
    ),
    "",
  ];
}
