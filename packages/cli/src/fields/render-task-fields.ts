import { type Cell, renderCell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import { type FieldJsonValue, formatJsonValue } from "./field-value.js";

export type TaskFieldJson = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly value: FieldJsonValue;
};

export function renderTaskFields(
  ui: Ui,
  view: {
    readonly label: string;
    readonly title: string;
    readonly url: string;
    readonly fields: ReadonlyArray<TaskFieldJson>;
  },
): string[] {
  const { theme, glyphs } = ui;
  const head = `  ${renderCell([text(view.label, theme.strong, view.url)], ui)} ${theme.muted(glyphs.separator)} `;
  const title = truncate(
    view.title,
    Math.max(ui.caps.columns - stringWidth(head), 8),
    glyphs.ellipsis,
  );
  const lines = ["", `${head}${title}`, ""];
  if (view.fields.length === 0) {
    lines.push(`    ${theme.muted("This project has no custom fields.")}`, "");
    return lines;
  }
  lines.push(
    ...renderTable(
      ui,
      view.fields,
      [
        {
          header: "Field",
          minWidth: 10,
          cell: (field): Cell => [text(field.name, theme.muted)],
        },
        {
          header: "Value",
          flex: true,
          minWidth: 12,
          cell: (field): Cell => {
            const value = formatJsonValue(field.value);
            return value === null
              ? [text("not set", theme.muted)]
              : [text(value)];
          },
        },
      ],
      { width: ui.caps.columns, indent: 4 },
    ),
    "",
  );
  return lines;
}
