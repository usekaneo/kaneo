import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type { FieldJson } from "./field-json.js";
import { fieldTypeLabel } from "./field-types.js";

export function renderFieldList(
  ui: Ui,
  view: {
    readonly projectName: string;
    readonly fields: ReadonlyArray<FieldJson>;
  },
): string[] {
  const { theme } = ui;
  if (view.fields.length === 0) {
    return [
      "",
      `  ${theme.muted(`No custom fields in ${view.projectName} yet.`)}`,
      `  ${theme.muted("Add one with kaneo field create <name> --type text.")}`,
      "",
    ];
  }
  return [
    "",
    ...renderTable(
      ui,
      view.fields,
      [
        {
          header: "Name",
          minWidth: 10,
          cell: (field): Cell => [text(field.name, theme.strong)],
        },
        {
          header: "Type",
          cell: (field): Cell => [text(fieldTypeLabel(field.type))],
        },
        {
          header: "Options",
          flex: true,
          minWidth: 12,
          optional: true,
          cell: (field): Cell => [text(field.options.join(", "), theme.muted)],
        },
        {
          header: "Required",
          optional: true,
          cell: (field): Cell =>
            field.required ? [text("required", theme.warning)] : [],
        },
      ],
      { width: ui.caps.columns, indent: 2 },
    ),
    "",
  ];
}
