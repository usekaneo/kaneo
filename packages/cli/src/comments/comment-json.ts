import type { TaskComment } from "../api/comments.js";

export type CommentAuthor = { readonly id: string; readonly name: string };

export type CommentJson = {
  readonly id: string;
  readonly taskId: string;
  readonly author: CommentAuthor | null;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly edited: boolean;
};

const EDIT_GRACE_MS = 1000;

export function isEdited(createdAt: string, updatedAt: string): boolean {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  return (
    Number.isFinite(created) &&
    Number.isFinite(updated) &&
    updated - created > EDIT_GRACE_MS
  );
}

export function toCommentJson(comment: TaskComment): CommentJson {
  return {
    id: comment.id,
    taskId: comment.taskId,
    author:
      comment.userId && comment.user
        ? { id: comment.userId, name: comment.user.name }
        : null,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    edited: isEdited(comment.createdAt, comment.updatedAt),
  };
}

export function latest<A>(items: ReadonlyArray<A>, limit: number): A[] {
  return items.slice(Math.max(0, items.length - limit));
}
