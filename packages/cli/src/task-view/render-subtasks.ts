import type { RelatedTaskJson } from "../relations/group-relations.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import { relatedTaskColumns } from "./related-task-columns.js";
import { sectionTitle } from "./section-title.js";

export function renderSubtasks(
  ui: Ui,
  subtasks: ReadonlyArray<RelatedTaskJson>,
): string[] {
  if (subtasks.length === 0) return [];
  const done = subtasks.filter((task) => task.completed).length;
  return [
    sectionTitle(ui, "Subtasks", `${done} of ${subtasks.length} done`),
    ...renderTable(
      ui,
      subtasks,
      relatedTaskColumns(ui, (task: RelatedTaskJson) => task),
      { width: ui.caps.columns, indent: 4, gap: 2 },
    ),
    "",
  ];
}
