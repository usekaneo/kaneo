import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import { PRIORITY_LABELS } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";

export type AppliedChange =
  | { readonly kind: "status"; readonly columnName: string }
  | { readonly kind: "priority"; readonly priority: string }
  | { readonly kind: "assignee"; readonly name: string }
  | { readonly kind: "unassign" }
  | { readonly kind: "due"; readonly dueDate: string | null }
  | { readonly kind: "addLabel"; readonly labelName: string }
  | { readonly kind: "removeLabel"; readonly labelName: string }
  | { readonly kind: "delete" };

export type BulkResultView = {
  readonly change: AppliedChange;
  readonly updated: number;
  readonly tasks: ReadonlyArray<{
    readonly label: string;
    readonly title: string;
    readonly url: string;
  }>;
};

function tasks(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function bulkHeadline(
  change: AppliedChange,
  total: number,
  updated: number,
): { readonly text: string; readonly aside: string | null } {
  const all = tasks(total);
  switch (change.kind) {
    case "status":
      return { text: `Moved ${all} to ${change.columnName}`, aside: null };
    case "priority": {
      const label = PRIORITY_LABELS[change.priority];
      return label
        ? { text: `Set priority to ${label} on ${all}`, aside: null }
        : { text: `Cleared the priority on ${all}`, aside: null };
    }
    case "assignee":
      return { text: `Assigned ${all} to ${change.name}`, aside: null };
    case "unassign":
      return { text: `Unassigned ${all}`, aside: null };
    case "due":
      return change.dueDate === null
        ? { text: `Cleared the due date on ${all}`, aside: null }
        : {
            text: `Set the due date to ${day(change.dueDate)} on ${all}`,
            aside: null,
          };
    case "addLabel":
      if (updated === 0) {
        return {
          text: `No change: ${total === 1 ? "the task" : `all ${all}`} already had ${change.labelName}`,
          aside: null,
        };
      }
      return {
        text: `Added ${change.labelName} to ${tasks(updated)}`,
        aside: updated < total ? `${total - updated} already had it` : null,
      };
    case "removeLabel":
      if (updated === 0) {
        return {
          text:
            total === 1
              ? `No change: the task did not have ${change.labelName}`
              : `No change: none of the ${all} had ${change.labelName}`,
          aside: null,
        };
      }
      return {
        text: `Removed ${change.labelName} from ${tasks(updated)}`,
        aside: updated < total ? `${total - updated} did not have it` : null,
      };
    case "delete":
      return { text: `Deleted ${tasks(updated)}`, aside: null };
  }
}

export function renderBulkResult(ui: Ui, view: BulkResultView): string[] {
  const { theme, glyphs } = ui;
  const headline = bulkHeadline(view.change, view.tasks.length, view.updated);
  const linked = view.change.kind !== "delete";
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${headline.text}${headline.aside ? ` ${theme.muted(`(${headline.aside})`)}` : ""}`,
    "",
    ...renderTable(
      ui,
      view.tasks,
      [
        {
          header: "ID",
          cell: (task): Cell => [
            text(task.label, theme.muted, linked ? task.url : undefined),
          ],
        },
        {
          header: "Title",
          flex: true,
          minWidth: 16,
          cell: (task): Cell => [
            text(task.title, undefined, linked ? task.url : undefined),
          ],
        },
      ],
      { width: ui.caps.columns, indent: 4, gap: 2 },
    ),
    "",
  ];
}
