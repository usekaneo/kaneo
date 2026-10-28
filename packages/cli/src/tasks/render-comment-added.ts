import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import { firstLine } from "./comment-text.js";

export type CommentAdded = {
  readonly label: string;
  readonly url: string;
  readonly content: string;
};

export function renderCommentAdded(ui: Ui, comment: CommentAdded): string[] {
  const { theme, glyphs } = ui;
  const id = renderCell([text(comment.label, theme.strong, comment.url)], ui);
  const head = `  ${theme.success(glyphs.tick)} Commented on ${id}`;
  const preview = firstLine(comment.content);
  if (preview.line === "") return ["", head, ""];
  const room = Math.max(ui.caps.columns - stringWidth(head) - 3, 8);
  const shown = truncate(
    preview.more ? `${preview.line} ${glyphs.ellipsis}` : preview.line,
    room,
    glyphs.ellipsis,
  );
  return ["", `${head} ${theme.muted(`${glyphs.separator} ${shown}`)}`, ""];
}
