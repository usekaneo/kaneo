import { type Cell, renderCell, text } from "../render/cell.js";
import { type Column, renderTable } from "../render/table.js";
import { statusDot, statusStyle } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import { descriptionPreview } from "./description-preview.js";
import { barSegments } from "./progress-bar.js";
import type { ColumnCountJson, ProjectViewJson } from "./project-view.js";

export type ProjectViewScreen = ProjectViewJson & {
  readonly taskLimit: number;
};

const MAX_BAR = 20;

function taskCount(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

function columnLines(
  ui: Ui,
  columns: ReadonlyArray<ColumnCountJson>,
): string[] {
  const { theme } = ui;
  const counted = columns.reduce((sum, column) => sum + column.taskCount, 0);
  const nameWidth =
    Math.max(...columns.map((column) => stringWidth(column.name))) + 2;
  const countWidth = Math.max(
    ...columns.map((column) => String(column.taskCount).length),
  );
  const barWidth = Math.min(
    MAX_BAR,
    ui.caps.columns - 2 - nameWidth - countWidth - 4,
  );
  const table: Array<Column<ColumnCountJson>> = [
    {
      header: "Column",
      flex: true,
      minWidth: 6,
      cell: (column): Cell => [
        statusDot(ui, column.slug, column.isFinal),
        text(" "),
        text(column.name),
      ],
    },
    {
      header: "Tasks",
      align: "right",
      cell: (column): Cell => [
        text(
          String(column.taskCount),
          column.taskCount === 0 ? theme.muted : undefined,
        ),
      ],
    },
  ];
  if (barWidth >= 4) {
    table.push({
      header: "Share",
      optional: true,
      cell: (column): Cell =>
        barSegments(
          ui,
          counted > 0 ? column.taskCount / counted : 0,
          barWidth,
          statusStyle(ui, column.slug, column.isFinal),
        ),
    });
  }
  return renderTable(ui, columns, table, { width: ui.caps.columns, indent: 2 });
}

export function renderProjectView(ui: Ui, view: ProjectViewScreen): string[] {
  const { theme, glyphs } = ui;
  const lines = [
    "",
    `  ${renderCell([text(view.name, theme.strong, view.url)], ui)} ${theme.muted(`${glyphs.separator} ${view.key} ${glyphs.separator} ${taskCount(view.totalTasks)}`)}`,
    `  ${renderCell([text(view.url, theme.muted, view.url)], ui)}`,
    "",
  ];

  const preview = descriptionPreview(view.description);
  if (preview.lines.length > 0) {
    const width = Math.max(10, ui.caps.columns - 2);
    for (const line of preview.lines) {
      lines.push(line ? `  ${truncate(line, width, glyphs.ellipsis)}` : "");
    }
    if (preview.more) lines.push(`  ${theme.muted(glyphs.ellipsis)}`);
    lines.push("");
  }

  if (view.columns.length === 0) {
    lines.push(`  ${theme.muted("This project has no columns yet.")}`, "");
    return lines;
  }

  lines.push(...columnLines(ui, view.columns), "");
  const counted = view.columns.reduce(
    (sum, column) => sum + column.taskCount,
    0,
  );
  const hidden = view.totalTasks - counted;
  if (view.totalTasks > view.taskLimit) {
    lines.push(
      `  ${theme.muted(`Counts cover the first ${view.taskLimit} tasks.`)}`,
      "",
    );
  } else if (hidden > 0) {
    const more = hidden === 1 ? "1 more task is" : `${hidden} more tasks are`;
    lines.push(`  ${theme.muted(`${more} planned or archived.`)}`, "");
  }
  return lines;
}
