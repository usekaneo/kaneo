import { type Cell, renderCell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import { formatDue } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import { formatDuration } from "./duration.js";
import type { TimeEntryJson } from "./time-entry-json.js";

export type TimeEntriesView = {
  readonly label: string;
  readonly url: string;
  readonly title: string;
  readonly entries: ReadonlyArray<TimeEntryJson>;
  readonly now: Date;
};

export function totalSeconds(entries: ReadonlyArray<TimeEntryJson>): number {
  return entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
}

export function renderTimeEntries(ui: Ui, view: TimeEntriesView): string[] {
  const { theme, glyphs } = ui;
  const header = `  ${renderCell([text(view.label, theme.strong, view.url)], ui)} ${theme.muted(glyphs.separator)} ${view.title}`;
  if (view.entries.length === 0) {
    return [
      "",
      header,
      "",
      `  ${theme.muted("No time logged yet.")}`,
      "",
      `  ${theme.muted("Log some with")} ${theme.strong(`kaneo time log ${view.label} 1h`)}`,
      "",
    ];
  }
  const rows = renderTable(
    ui,
    view.entries,
    [
      {
        header: "Date",
        cell: (entry): Cell => [
          text(formatDue(new Date(entry.startedAt), view.now)),
        ],
      },
      {
        header: "Duration",
        align: "right",
        cell: (entry): Cell =>
          entry.running
            ? [
                text(`${glyphs.dot} `, theme.success),
                text(formatDuration(entry.durationSeconds)),
              ]
            : [text(formatDuration(entry.durationSeconds))],
      },
      {
        header: "User",
        optional: true,
        minWidth: 10,
        cell: (entry): Cell =>
          entry.user ? [text(entry.user.name ?? "Unknown", theme.muted)] : [],
      },
      {
        header: "Note",
        flex: true,
        minWidth: 8,
        cell: (entry): Cell => (entry.note ? [text(entry.note)] : []),
      },
      {
        header: "ID",
        cell: (entry): Cell => [text(entry.id, theme.muted)],
      },
    ],
    { width: ui.caps.columns, indent: 4 },
  );
  const count = view.entries.length;
  return [
    "",
    header,
    "",
    ...rows,
    "",
    `    ${theme.muted("Total")} ${theme.strong(formatDuration(totalSeconds(view.entries)))} ${theme.muted(`${glyphs.separator} ${count} ${count === 1 ? "entry" : "entries"}`)}`,
    "",
  ];
}
