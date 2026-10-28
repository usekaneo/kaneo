import { renderCell, text } from "../render/cell.js";
import { statusDot } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";

export type ColumnChange = {
  readonly verb: "Created" | "Updated" | "Moved" | "Deleted";
  readonly column: {
    readonly name: string;
    readonly slug: string;
    readonly isFinal: boolean;
  };
  readonly details: ReadonlyArray<string>;
};

export function renderColumnChange(ui: Ui, change: ColumnChange): string[] {
  const { theme, glyphs } = ui;
  const name = renderCell(
    [
      statusDot(ui, change.column.slug, change.column.isFinal),
      text(` ${change.column.name}`, theme.strong),
    ],
    ui,
  );
  const separator = ` ${theme.muted(glyphs.separator)} `;
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${change.verb} ${[name, ...change.details.filter((detail) => detail !== "")].join(separator)}`,
    "",
  ];
}
