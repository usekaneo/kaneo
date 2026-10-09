import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

export const TaskComment = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  userId: Schema.NullOr(Schema.String),
  content: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  user: Schema.NullOr(Schema.Struct({ name: Schema.String })),
});
export type TaskComment = typeof TaskComment.Type;

export const TaskCommentList = Schema.Array(TaskComment);

export const CommentRow = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  content: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CommentRow = typeof CommentRow.Type;

function commentPath(id: string): string {
  return `/api/comment/${encodeURIComponent(id)}`;
}

export const listComments = Effect.fnUntraced(function* (taskId: string) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", commentPath(taskId), TaskCommentList);
});

export const updateComment = Effect.fnUntraced(function* (
  id: string,
  content: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", commentPath(id), CommentRow, {
    body: { content },
  });
});

export const deleteComment = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request("DELETE", commentPath(id), CommentRow);
});
