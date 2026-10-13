import { toIsoDate } from "../markdown.js";
import type { ImportedComment, ImportedPerson } from "../types.js";
import type { LinearComment } from "./client.js";
import { toPerson } from "./people.js";

const FALLBACK_AUTHOR = "Linear";

export function commentAuthor(comment: LinearComment): ImportedPerson {
  const user = toPerson(comment.user);
  if (user?.name) return user;
  const name = comment.botActor?.name?.trim() || FALLBACK_AUTHOR;
  return { ...user, name };
}

export function groupComments(
  comments: LinearComment[],
): Map<string, ImportedComment[]> {
  const byIssue = new Map<string, ImportedComment[]>();
  const ordered = [...comments].sort(
    (a, b) => timestamp(a.createdAt) - timestamp(b.createdAt),
  );

  for (const comment of ordered) {
    const issueId = comment.issue?.id;
    if (!issueId) continue;
    const createdAt = toIsoDate(comment.createdAt);
    const list = byIssue.get(issueId) ?? [];
    list.push({
      author: commentAuthor(comment),
      body: comment.body ?? "",
      ...(createdAt ? { createdAt } : {}),
    });
    byIssue.set(issueId, list);
  }

  return byIssue;
}

function timestamp(value: string | null): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
