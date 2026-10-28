import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import { firstLine } from "../tasks/comment-text.js";
import { inlineText } from "../tasks/plain-description.js";

export type CommentChange = {
  readonly verb: "Edited" | "Deleted";
  readonly label: string;
  readonly url: string;
  readonly content: string;
};

export function renderCommentChange(ui: Ui, change: CommentChange): string[] {
  const { theme, glyphs } = ui;
  const id = renderCell([text(change.label, theme.strong, change.url)], ui);
  const head = `  ${theme.success(glyphs.tick)} ${change.verb} a comment on ${id}`;
  const preview = firstLine(change.content);
  const line = inlineText(preview.line).trim();
  if (line === "") return ["", head, ""];
  const room = Math.max(ui.caps.columns - stringWidth(head) - 3, 8);
  const shown = truncate(
    preview.more ? `${line} ${glyphs.ellipsis}` : line,
    room,
    glyphs.ellipsis,
  );
  return ["", `${head} ${theme.muted(`${glyphs.separator} ${shown}`)}`, ""];
}
