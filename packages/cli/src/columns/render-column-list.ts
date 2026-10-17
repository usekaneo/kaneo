import { type Cell, renderCell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import { statusDot } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import type { ColumnJson } from "./column-json.js";

export type ColumnListView = {
  readonly projectName: string;
  readonly projectSlug: string;
  readonly projectUrl: string;
  readonly columns: ReadonlyArray<ColumnJson>;
};

function taskCount(count: number | null): string {
  if (count === null) return "";
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

export function renderColumnList(ui: Ui, view: ColumnListView): string[] {
  const { theme, glyphs } = ui;
  const header = `  ${renderCell([text(view.projectName, theme.strong, view.projectUrl)], ui)} ${theme.muted(`${glyphs.separator} ${view.projectSlug.toUpperCase()}`)}`;
  if (view.columns.length === 0) {
    return ["", header, "", `  ${theme.muted("No columns yet.")}`, ""];
  }
  const numbered = view.columns.map((column, index) => ({
    column,
    number: index + 1,
  }));
  const rows = renderTable(
    ui,
    numbered,
    [
      {
        header: "#",
        align: "right",
        cell: ({ number }): Cell => [text(String(number), theme.muted)],
      },
      {
        header: "Name",
        flex: true,
        minWidth: 10,
        cell: ({ column }): Cell => [
          statusDot(ui, column.slug, column.isFinal),
          text(` ${column.name}`),
        ],
      },
      {
        header: "Slug",
        optional: true,
        cell: ({ column }): Cell => [text(column.slug, theme.muted)],
      },
      {
        header: "Final",
        cell: ({ column }): Cell =>
          column.isFinal ? [text("final", theme.success)] : [],
      },
      {
        header: "Tasks",
        align: "right",
        optional: true,
        cell: ({ column }): Cell => [
          text(taskCount(column.taskCount), theme.muted),
        ],
      },
    ],
    { width: ui.caps.columns, indent: 4 },
  );
  return ["", header, "", ...rows, ""];
}
