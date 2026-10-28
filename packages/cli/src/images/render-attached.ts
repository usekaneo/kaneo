import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";

export type Attached = {
  readonly label: string;
  readonly url: string;
  readonly names: ReadonlyArray<string>;
  readonly target: "description" | "comment";
};

export function attachedSummary(names: ReadonlyArray<string>): string {
  if (names.length === 1) return names[0] ?? "1 file";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.length} files`;
}

export function renderAttached(ui: Ui, attached: Attached): string[] {
  const { theme, glyphs } = ui;
  const id = renderCell([text(attached.label, theme.strong, attached.url)], ui);
  const where =
    attached.target === "comment"
      ? "posted as a comment"
      : "added to the description";
  return [
    `  ${theme.success(glyphs.tick)} Attached ${attachedSummary(attached.names)} to ${id} ${theme.muted(`${glyphs.separator} ${where}`)}`,
    "",
  ];
}
