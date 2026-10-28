import { toIsoDate } from "../markdown.js";
import type { ImportedComment } from "../types.js";
import type { JiraComment } from "./api-types.js";
import type { HtmlToMarkdown } from "./html.js";
import { toPerson } from "./people.js";

export const FALLBACK_AUTHOR = "Jira user";

export function mapComments(
  comments: JiraComment[],
  toMarkdown: HtmlToMarkdown,
): ImportedComment[] {
  const mapped: ImportedComment[] = [];
  for (const comment of comments) {
    const body = commentBody(comment, toMarkdown);
    if (!body) continue;
    const person = toPerson(comment.author);
    const createdAt = toIsoDate(comment.created);
    mapped.push({
      author: {
        name: person?.name ?? person?.email ?? FALLBACK_AUTHOR,
        ...(person?.email ? { email: person.email } : {}),
      },
      body,
      ...(createdAt ? { createdAt } : {}),
    });
  }
  return mapped.sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));
}

function commentBody(comment: JiraComment, toMarkdown: HtmlToMarkdown): string {
  if (typeof comment.renderedBody === "string") {
    return toMarkdown(comment.renderedBody);
  }
  return typeof comment.body === "string" ? comment.body.trim() : "";
}

function timestamp(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
