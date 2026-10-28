import type { CommentJson } from "../comments/comment-json.js";
import { relativeTime } from "../comments/relative-time.js";
import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import {
  type DescriptionLine,
  plainDescription,
} from "../tasks/plain-description.js";
import { sectionTitle } from "./section-title.js";

export type CommentsView = {
  readonly comments: ReadonlyArray<CommentJson>;
  readonly total: number;
  readonly reference: string;
  readonly now: Date;
  readonly full?: boolean;
};

const PREVIEW_LINES = 3;
const HEAD = "    ";
const BODY = "      ";

function renderAuthor(ui: Ui, comment: CommentJson, now: Date): string {
  const { theme, glyphs } = ui;
  const meta = [
    relativeTime(new Date(comment.createdAt), now),
    comment.edited ? "edited" : "",
  ]
    .filter((part) => part !== "")
    .map((part) => ` ${glyphs.separator} ${part}`)
    .join("");
  const room = ui.caps.columns - HEAD.length - stringWidth(meta);
  const name = truncate(
    comment.author?.name ?? "Someone",
    Math.max(room, 8),
    glyphs.ellipsis,
  );
  return `${HEAD}${theme.strong(name)}${theme.muted(meta)}`;
}

function renderBody(ui: Ui, content: string, full: boolean): string[] {
  const { theme, glyphs } = ui;
  const width = ui.caps.columns - BODY.length;
  const parsed = plainDescription(content, {
    width,
    unicode: ui.caps.unicode,
  }).lines;
  const style = (line: DescriptionLine, text: string) =>
    line.kind === "heading"
      ? theme.strong(text)
      : line.kind === "muted"
        ? theme.muted(text)
        : text;
  if (parsed.length === 0) return [`${BODY}${theme.muted("(empty)")}`];
  if (full) {
    return parsed.map((line) =>
      line.text ? `${BODY}${style(line, line.text)}` : "",
    );
  }
  const lines = parsed.filter((line) => line.text.trim() !== "");
  const shown = lines.slice(0, PREVIEW_LINES);
  return shown.map((line, index) => {
    const cut = index === shown.length - 1 && lines.length > shown.length;
    if (!cut) return `${BODY}${style(line, line.text)}`;
    const marker = ` ${glyphs.ellipsis}`;
    return stringWidth(line.text) + stringWidth(marker) <= width
      ? `${BODY}${style(line, line.text)}${theme.muted(marker)}`
      : `${BODY}${style(line, truncate(line.text, width, glyphs.ellipsis))}`;
  });
}

export function renderComments(ui: Ui, view: CommentsView): string[] {
  if (view.comments.length === 0) return [];
  const { theme } = ui;
  const hidden = view.total - view.comments.length;
  const lines = [sectionTitle(ui, hidden > 0 ? "Recent comments" : "Comments")];
  for (const [index, comment] of view.comments.entries()) {
    if (index > 0) lines.push("");
    lines.push(
      renderAuthor(ui, comment, view.now),
      ...renderBody(ui, comment.content, view.full ?? false),
    );
  }
  if (hidden > 0) {
    const more = `and ${hidden} more, run`;
    const command = `kaneo comment list ${view.reference}`;
    const fits =
      HEAD.length + stringWidth(more) + 1 + stringWidth(command) <=
      ui.caps.columns;
    lines.push(
      "",
      ...(fits
        ? [`${HEAD}${theme.muted(more)} ${theme.strong(command)}`]
        : [`${HEAD}${theme.muted(more)}`, `${HEAD}${theme.strong(command)}`]),
    );
  }
  lines.push("");
  return lines;
}
