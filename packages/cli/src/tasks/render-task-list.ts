import { type Cell, renderCell, text } from "../render/cell.js";
import { projectUrl } from "../render/links.js";
import { renderTable } from "../render/table.js";
import {
  dueSegments,
  prioritySegments,
  statusDot,
} from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import type { BoardColumnSummary } from "./load-board.js";
import type { TaskJson } from "./task-json.js";

export type TaskListView = {
  readonly projectName: string;
  readonly projectSlug: string;
  readonly projectId: string;
  readonly workspaceId: string;
  readonly webUrl: string;
  readonly columns: ReadonlyArray<BoardColumnSummary>;
  readonly tasks: ReadonlyArray<TaskJson>;
  readonly total: number;
  readonly now: Date;
};

export function renderTaskList(ui: Ui, view: TaskListView): string[] {
  const { theme, glyphs } = ui;
  const link = projectUrl(view.webUrl, {
    workspaceId: view.workspaceId,
    id: view.projectId,
  });
  const header = `  ${renderCell([text(view.projectName, theme.strong, link)], ui)} ${theme.muted(`${glyphs.separator} ${view.projectSlug.toUpperCase()}`)}`;
  if (view.tasks.length === 0) {
    return ["", header, "", `  ${theme.muted("No tasks match.")}`, ""];
  }

  const groups = view.columns
    .map((column) => ({
      column,
      tasks: view.tasks.filter((task) => task.status === column.slug),
    }))
    .filter((group) => group.tasks.length > 0);
  const known = new Set(view.columns.map((column) => column.slug));
  const orphans = view.tasks.filter((task) => !known.has(task.status));
  if (orphans.length > 0) {
    groups.push({
      column: { slug: "other", name: "Other", isFinal: false },
      tasks: orphans,
    });
  }

  const ordered = groups.flatMap((group) => group.tasks);
  const finalSlugs = new Set(
    view.columns
      .filter((column) => column.isFinal)
      .map((column) => column.slug),
  );
  const lines = renderTable(
    ui,
    ordered,
    [
      {
        header: "ID",
        cell: (task): Cell => [
          text(task.ticketId ?? task.id.slice(0, 8), theme.muted, task.url),
        ],
      },
      {
        header: "Title",
        flex: true,
        minWidth: 16,
        cell: (task): Cell => [text(task.title, undefined, task.url)],
      },
      {
        header: "Priority",
        optional: true,
        cell: (task): Cell => prioritySegments(ui, task.priority),
      },
      {
        header: "Assignee",
        optional: true,
        minWidth: 10,
        cell: (task): Cell =>
          task.assignee?.name ? [text(task.assignee.name)] : [],
      },
      {
        header: "Due",
        optional: true,
        cell: (task): Cell =>
          dueSegments(ui, task.dueDate, finalSlugs.has(task.status), view.now),
      },
    ],
    { width: ui.caps.columns, indent: 4, gap: 2 },
  );

  const output = ["", header, ""];
  let offset = 0;
  for (const group of groups) {
    const dot = statusDot(ui, group.column.slug, group.column.isFinal);
    output.push(
      `  ${dot.style ? dot.style(dot.text) : dot.text} ${theme.strong(group.column.name)} ${theme.muted(String(group.tasks.length))}`,
    );
    output.push(...lines.slice(offset, offset + group.tasks.length));
    output.push("");
    offset += group.tasks.length;
  }
  if (view.total > view.tasks.length) {
    output.push(
      `  ${theme.muted(`Showing ${view.tasks.length} of ${view.total} tasks. Pass --limit to see more.`)}`,
      "",
    );
  }
  return output;
}
