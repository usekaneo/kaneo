import { type Cell, text } from "../render/cell.js";
import { labelChipSegment } from "../render/label-chip.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";

export type LabelListRow = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly tasks: number;
  readonly deleting: boolean;
};

function taskCount(count: number): string {
  if (count === 0) return "no tasks";
  return count === 1 ? "1 task" : `${count} tasks`;
}

export function renderLabelList(
  ui: Ui,
  rows: ReadonlyArray<LabelListRow>,
): string[] {
  const { theme, glyphs } = ui;
  if (rows.length === 0) {
    return [
      "",
      `  ${theme.muted("No labels in this workspace yet. Create one with kaneo label create <name>.")}`,
      "",
    ];
  }
  return [
    "",
    ...renderTable(
      ui,
      rows,
      [
        {
          header: "",
          cell: (row): Cell => [labelChipSegment(ui, row.color)],
        },
        {
          header: "Name",
          flex: true,
          minWidth: 12,
          cell: (row): Cell => [
            text(row.name, row.deleting ? theme.muted : undefined),
            ...(row.deleting
              ? [text(` ${glyphs.separator} deleting`, theme.warning)]
              : []),
          ],
        },
        {
          header: "Tasks",
          align: "right",
          optional: true,
          cell: (row): Cell => [
            text(
              taskCount(row.tasks),
              row.tasks === 0 ? theme.muted : undefined,
            ),
          ],
        },
      ],
      { width: ui.caps.columns, indent: 2, gap: 2 },
    ),
    "",
  ];
}
