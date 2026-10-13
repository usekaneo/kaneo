import { type Cell, type Segment, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import { dueSegments } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import { progressSegments } from "./progress-bar.js";
import type { ProjectJson } from "./project-json.js";

export type ProjectListView = {
  readonly projects: ReadonlyArray<ProjectJson>;
  readonly includeArchived: boolean;
  readonly now: Date;
};

function taskCount(count: number): string {
  if (count === 0) return "no tasks";
  return count === 1 ? "1 task" : `${count} tasks`;
}

export function renderProjectList(ui: Ui, view: ProjectListView): string[] {
  const { theme, glyphs } = ui;
  const quiet = (
    project: ProjectJson,
    segments: ReadonlyArray<Segment>,
  ): Cell =>
    project.archived
      ? segments.map((segment) => ({ ...segment, style: theme.muted }))
      : segments;
  if (view.projects.length === 0) {
    return [
      "",
      `  ${theme.muted(view.includeArchived ? "No projects in this workspace yet." : "No active projects in this workspace.")}`,
      "",
    ];
  }
  const ordered = [
    ...view.projects.filter((project) => !project.archived),
    ...view.projects.filter((project) => project.archived),
  ];
  return [
    "",
    ...renderTable(
      ui,
      ordered,
      [
        {
          header: "Key",
          cell: (project): Cell => [
            text(
              project.key,
              project.archived ? theme.muted : theme.strong,
              project.url,
            ),
          ],
        },
        {
          header: "Name",
          flex: true,
          minWidth: 12,
          cell: (project): Cell => [
            text(
              project.name,
              project.archived ? theme.muted : undefined,
              project.url,
            ),
            ...(project.archived
              ? [text(` ${glyphs.separator} archived`, theme.muted)]
              : []),
          ],
        },
        {
          header: "Tasks",
          align: "right",
          optional: true,
          cell: (project): Cell => [
            text(
              taskCount(project.totalTasks),
              project.archived || project.totalTasks === 0
                ? theme.muted
                : undefined,
            ),
          ],
        },
        {
          header: "Progress",
          optional: true,
          cell: (project): Cell =>
            project.totalTasks > 0
              ? quiet(project, progressSegments(ui, project.completion))
              : [],
        },
        {
          header: "Due",
          optional: true,
          cell: (project): Cell =>
            dueSegments(
              ui,
              project.dueDate,
              project.archived || project.completion === 100,
              view.now,
            ),
        },
      ],
      { width: ui.caps.columns, indent: 2, gap: 3 },
    ),
    "",
  ];
}
