import { renderCell, text } from "../render/cell.js";
import { statusDot } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";

export type StatusRef = {
  readonly slug: string;
  readonly name: string;
  readonly isFinal: boolean;
};

export type StatusChange = {
  readonly label: string;
  readonly url: string;
  readonly from: StatusRef;
  readonly to: StatusRef;
};

export function renderStatusChange(ui: Ui, change: StatusChange): string[] {
  const { theme, glyphs } = ui;
  const status = (ref: StatusRef) =>
    renderCell(
      [statusDot(ui, ref.slug, ref.isFinal), text(` ${ref.name}`)],
      ui,
    );
  const id = renderCell([text(change.label, theme.strong, change.url)], ui);
  const movement =
    change.from.slug === change.to.slug
      ? `${theme.muted("already in")} ${status(change.to)}`
      : `${status(change.from)} ${theme.muted(glyphs.arrow)} ${status(change.to)}`;
  return [
    "",
    `  ${theme.success(glyphs.tick)} ${id} ${theme.muted(glyphs.separator)} ${movement}`,
    "",
  ];
}
