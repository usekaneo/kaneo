import type { Ui } from "../render/ui.js";
import { stringWidth, truncate } from "../render/width.js";
import {
  type DescriptionLine,
  plainDescription,
} from "../tasks/plain-description.js";
import type { CommentJson } from "./comment-json.js";
import { relativeTime } from "./relative-time.js";
import { renderTaskHeading } from "./render-task-heading.js";

export type CommentListView = {
  readonly label: string;
  readonly title: string;
  readonly url: string;
  readonly comments: ReadonlyArray<CommentJson>;
  readonly total: number;
  readonly now: Date;
};

const INDENT = "    ";

function countLabel(count: number): string {
  return count === 1 ? "1 comment" : `${count} comments`;
}

function renderCommentHeader(ui: Ui, comment: CommentJson, now: Date): string {
  const { theme, glyphs } = ui;
  const when = relativeTime(new Date(comment.createdAt), now);
  const meta = [when, comment.edited ? "edited" : ""]
    .filter((part) => part !== "")
    .map((part) => ` ${glyphs.separator} ${part}`)
    .join("");
  const id = `  ${comment.id}`;
  const room = ui.caps.columns - 2 - stringWidth(meta) - stringWidth(id);
  const name = truncate(
    comment.author?.name ?? "Someone",
    Math.max(room, 8),
    glyphs.ellipsis,
  );
  return `  ${theme.strong(name)}${theme.muted(meta)}${theme.muted(id)}`;
}

function renderBody(ui: Ui, content: string): string[] {
  const { theme } = ui;
  const body = plainDescription(content, {
    width: ui.caps.columns - INDENT.length,
    unicode: ui.caps.unicode,
  });
  if (body.lines.length === 0) return [`${INDENT}${theme.muted("(empty)")}`];
  const style = (line: DescriptionLine) =>
    line.kind === "heading"
      ? theme.strong(line.text)
      : line.kind === "muted"
        ? theme.muted(line.text)
        : line.text;
  return body.lines.map((line) => (line.text ? `${INDENT}${style(line)}` : ""));
}

export function renderCommentList(ui: Ui, view: CommentListView): string[] {
  const { theme } = ui;
  const heading = renderTaskHeading(ui, {
    label: view.label,
    title: view.title,
    url: view.url,
    meta: countLabel(view.total),
  });
  if (view.comments.length === 0) {
    return [
      "",
      heading,
      "",
      `  ${theme.muted("No comments yet. Add one with")} ${theme.strong(`kaneo comment add ${view.label}`)}`,
      "",
    ];
  }
  const lines = ["", heading, ""];
  if (view.total > view.comments.length) {
    lines.push(
      `  ${theme.muted(`Showing the latest ${view.comments.length} of ${view.total}. Pass --limit to see more.`)}`,
      "",
    );
  }
  for (const comment of view.comments) {
    lines.push(
      renderCommentHeader(ui, comment, view.now),
      ...renderBody(ui, comment.content),
      "",
    );
  }
  return lines;
}
