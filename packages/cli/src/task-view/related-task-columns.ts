import { type Cell, text } from "../render/cell.js";
import type { Column } from "../render/table.js";
import { statusDot } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import type { RelatedTaskJson } from "../relations/group-relations.js";

export function relatedTaskColumns<Row>(
  ui: Ui,
  taskOf: (row: Row) => RelatedTaskJson,
): Array<Column<Row>> {
  const { theme, glyphs } = ui;
  return [
    {
      header: "ID",
      cell: (row): Cell => {
        const task = taskOf(row);
        return [
          statusDot(ui, task.status, task.completed),
          text(" "),
          text(task.ticketId ?? task.id.slice(0, 8), theme.muted, task.url),
        ];
      },
    },
    {
      header: "Title",
      flex: true,
      minWidth: 16,
      cell: (row): Cell => [text(taskOf(row).title)],
    },
    {
      header: "Done",
      cell: (row): Cell =>
        taskOf(row).completed ? [text(glyphs.tick, theme.success)] : [],
    },
  ];
}
