import { type Cell, renderCell, text } from "../render/cell.js";
import { type Column, renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type { ImportReportJson, ImportTaskReport } from "./import-report.js";

function tasks(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

function tasksDo(count: number, singular: string, plural: string): string {
  return `${tasks(count)} ${count === 1 ? singular : plural}`;
}

export function renderImportWarnings(
  ui: Ui,
  report: ImportReportJson,
): string[] {
  const { theme, glyphs } = ui;
  const lines: string[] = [];
  const unknown = report.tasks.filter((task) =>
    report.unknownStatuses.includes(task.status),
  ).length;
  if (report.unknownStatuses.length > 0) {
    lines.push(
      `  ${theme.warning(glyphs.warning)} ${tasksDo(unknown, "uses a status", "use statuses")} ${report.project.name} does not have (${report.unknownStatuses.join(", ")}); ${unknown === 1 ? "it lands" : "they land"} in Planned.`,
    );
  }
  if (report.remappedStatuses.length > 0) {
    lines.push(
      `  ${theme.muted(glyphs.dot)} ${theme.muted(`Statuses matched to columns: ${report.remappedStatuses.map((remap) => `${remap.from} ${glyphs.arrow} ${remap.to}`).join(", ")}`)}`,
    );
  }
  if (report.tasksWithLabels > 0) {
    lines.push(
      `  ${theme.warning(glyphs.warning)} Labels are not imported; ${tasksDo(report.tasksWithLabels, "in the file has", "in the file have")} labels.`,
    );
  }
  return lines;
}

function noteCell(ui: Ui, task: ImportTaskReport): Cell {
  if (task.error) return [text(task.error, ui.theme.danger)];
  if (task.warnings.length > 0) {
    return [text(task.warnings.join("; "), ui.theme.warning)];
  }
  return [];
}

function markCell(ui: Ui, task: ImportTaskReport): Cell {
  if (task.imported === true) return [text(ui.glyphs.tick, ui.theme.success)];
  if (task.imported === false) return [text(ui.glyphs.cross, ui.theme.danger)];
  return [text(String(task.index), ui.theme.muted)];
}

export function renderImportReport(ui: Ui, report: ImportReportJson): string[] {
  const { theme, glyphs } = ui;
  const project = `${renderCell([text(report.project.name, theme.strong, report.project.url)], ui)} ${theme.muted(glyphs.separator)} ${report.project.key}`;
  const headline = report.dryRun
    ? `  ${theme.muted(glyphs.dot)} Dry run: ${tasks(report.total)} would be imported into ${project}`
    : report.failed === 0
      ? `  ${theme.success(glyphs.tick)} Imported ${tasks(report.imported)} into ${project}`
      : `  ${theme.danger(glyphs.cross)} Imported ${report.imported} of ${tasks(report.total)} into ${project}; ${report.failed} failed`;
  const warnings = report.dryRun ? renderImportWarnings(ui, report) : [];
  const withIds = report.tasks.some((task) => task.ticketId !== null);
  const idColumn: Column<ImportTaskReport> = {
    header: "ID",
    optional: true,
    cell: (task): Cell =>
      task.ticketId
        ? [text(task.ticketId, theme.muted, task.url ?? undefined)]
        : [],
  };
  const table = renderTable(
    ui,
    report.tasks,
    [
      {
        header: "",
        align: "right",
        cell: (task): Cell => markCell(ui, task),
      },
      ...(withIds ? [idColumn] : []),
      {
        header: "Status",
        optional: true,
        minWidth: 6,
        cell: (task): Cell => [text(task.statusName, theme.muted)],
      },
      {
        header: "Title",
        flex: true,
        minWidth: 24,
        cell: (task): Cell => [
          text(task.title, undefined, task.url ?? undefined),
        ],
      },
      {
        header: "Note",
        flex: true,
        optional: true,
        minWidth: 12,
        cell: (task): Cell => noteCell(ui, task),
      },
    ],
    { width: ui.caps.columns, indent: 4, gap: 2 },
  );
  return [
    "",
    headline,
    ...(warnings.length > 0 ? ["", ...warnings] : []),
    "",
    ...table,
    "",
    ...(report.dryRun
      ? [
          `  ${theme.muted("Nothing was imported. Run it again without --dry-run to import.")}`,
          "",
        ]
      : []),
  ];
}
