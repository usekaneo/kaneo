import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";

export type LinkChange = {
  readonly verb: "Linked" | "Unlinked";
  readonly taskLabel: string;
  readonly taskUrl: string;
  readonly linkTitle: string;
};

export function renderLinkChange(ui: Ui, change: LinkChange): string[] {
  const { theme, glyphs } = ui;
  const reference = renderCell(
    [text(change.taskLabel, theme.strong, change.taskUrl)],
    ui,
  );
  const head = `  ${theme.success(glyphs.tick)} ${change.verb} ${reference} ${theme.muted(glyphs.separator)} `;
  const title = truncate(
    change.linkTitle,
    Math.max(ui.caps.columns - stringWidth(head), 8),
    glyphs.ellipsis,
  );
  return ["", `${head}${title}`, ""];
}
