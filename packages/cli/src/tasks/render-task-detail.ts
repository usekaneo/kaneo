import { type Cell, fitCell, renderCell, text } from "../render/cell.js";
import {
  dueSegments,
  formatDue,
  prioritySegments,
  statusDot,
} from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import { labelChips } from "../task-view/label-chips.js";
import type { TaskViewJson } from "../task-view/task-view-json.js";
import { hasTrackedTime, timeValue } from "../task-view/time-value.js";
import { type DescriptionLine, plainDescription } from "./plain-description.js";

export type TaskDetailView = {
  readonly task: TaskViewJson;
  readonly statusFinal: boolean;
  readonly now: Date;
  readonly full?: boolean;
};

const DESCRIPTION_LINES = 40;
const INDENT = "    ";
const LABEL_WIDTH = 10;

function formatDay(value: string | null, now: Date): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDue(date, now);
}

export function renderTaskDetail(ui: Ui, view: TaskDetailView): string[] {
  const { theme, glyphs } = ui;
  const { task, now } = view;
  const reference = task.ticketId ?? task.id;
  const none = (label: string) => theme.muted(label);
  const unavailable = none("could not load");
  const valueWidth = ui.caps.columns - INDENT.length - LABEL_WIDTH - 1;
  const fit = (cell: Cell) =>
    renderCell(fitCell(cell, valueWidth, glyphs.ellipsis), ui);
  const priority = prioritySegments(ui, task.priority);
  const due = dueSegments(ui, task.dueDate, view.statusFinal, now);
  const labels =
    task.labels === null
      ? unavailable
      : task.labels.length > 0
        ? renderCell(labelChips(ui, task.labels, valueWidth), ui)
        : none("None");
  const time =
    task.time === null
      ? unavailable
      : hasTrackedTime(task.time)
        ? fit(timeValue(ui, task.time))
        : null;
  const parent = task.parent
    ? fit([
        statusDot(ui, task.parent.status, task.parent.completed),
        text(" "),
        text(
          task.parent.ticketId ?? task.parent.id.slice(0, 8),
          theme.muted,
          task.parent.url,
        ),
        text(` ${task.parent.title}`),
      ])
    : null;
  const rows: ReadonlyArray<readonly [string, string | null]> = [
    [
      "Status",
      `${renderCell([statusDot(ui, task.status, view.statusFinal)], ui)} ${task.statusName}`,
    ],
    [
      "Priority",
      priority.length > 0 ? renderCell(priority, ui) : none("No priority"),
    ],
    [
      "Assignee",
      task.assignee
        ? (task.assignee.name ?? task.assignee.id)
        : none("Unassigned"),
    ],
    ["Labels", labels],
    ["Due", due.length > 0 ? renderCell(due, ui) : none("None")],
    ["Start", formatDay(task.startDate, now) ?? none("None")],
    ["Created", formatDay(task.createdAt, now) ?? none("Unknown")],
    ["Time", time],
    [
      "Project",
      `${task.projectName} ${theme.muted(`${glyphs.separator} ${task.projectKey}`)}`,
    ],
    ["Parent", parent],
  ];

  const lines = [
    "",
    `  ${renderCell([text(task.ticketId ?? task.id.slice(0, 8), theme.muted, task.url)], ui)} ${theme.strong(task.title)}`,
    "",
    ...rows.flatMap(([label, value]) =>
      value === null
        ? []
        : [`${INDENT}${theme.muted(label.padEnd(LABEL_WIDTH))} ${value}`],
    ),
    "",
  ];

  const description = plainDescription(task.description ?? "", {
    width: ui.caps.columns - INDENT.length,
    unicode: ui.caps.unicode,
    maxLines: view.full ? Number.POSITIVE_INFINITY : DESCRIPTION_LINES,
  });
  if (description.lines.length === 0) {
    lines.push(`${INDENT}${theme.muted("No description.")}`, "");
    return lines;
  }
  const style = (line: DescriptionLine) =>
    line.kind === "heading"
      ? theme.strong(line.text)
      : line.kind === "muted"
        ? theme.muted(line.text)
        : line.text;
  lines.push(
    ...description.lines.map((line) =>
      line.text ? `${INDENT}${style(line)}` : "",
    ),
  );
  if (description.truncated) {
    lines.push(
      "",
      `${INDENT}${theme.muted("Run")} ${theme.strong(`kaneo task open ${reference}`)} ${theme.muted("to read the rest.")}`,
    );
  }
  lines.push("");
  return lines;
}
