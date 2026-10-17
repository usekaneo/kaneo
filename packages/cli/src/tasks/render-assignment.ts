import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";

export type Assignment = {
  readonly label: string;
  readonly url: string;
  readonly assignee: { readonly name: string } | null;
};

export function renderAssignment(ui: Ui, assignment: Assignment): string[] {
  const { theme, glyphs } = ui;
  const id = renderCell(
    [text(assignment.label, theme.strong, assignment.url)],
    ui,
  );
  const outcome = assignment.assignee
    ? `assigned to ${theme.strong(assignment.assignee.name)}`
    : "unassigned";
  return ["", `  ${theme.success(glyphs.tick)} ${id} ${outcome}`, ""];
}
