import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const UpdatedTask = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
  status: Schema.String,
  userId: NullableString,
});
export type UpdatedTask = typeof UpdatedTask.Type;

export const MovedTask = Schema.Struct({
  task: UpdatedTask,
  sourceProjectId: Schema.String,
  destinationProjectId: Schema.String,
});
export type MovedTask = typeof MovedTask.Type;

export const CreatedComment = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  content: NullableString,
  createdAt: Schema.String,
});
export type CreatedComment = typeof CreatedComment.Type;

export const COMMENT_MAX_LENGTH = 10_000;

export const updateTaskStatus = Effect.fnUntraced(function* (
  taskId: string,
  status: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    `/api/task/status/${encodeURIComponent(taskId)}`,
    UpdatedTask,
    { body: { status } },
  );
});

export const moveTask = Effect.fnUntraced(function* (
  taskId: string,
  destination: {
    readonly projectId: string;
    readonly status: string | undefined;
  },
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    `/api/task/move/${encodeURIComponent(taskId)}`,
    MovedTask,
    {
      body: {
        destinationProjectId: destination.projectId,
        ...(destination.status === undefined
          ? {}
          : { destinationStatus: destination.status }),
      },
    },
  );
});

export const updateTaskAssignee = Effect.fnUntraced(function* (
  taskId: string,
  userId: string | null,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    `/api/task/assignee/${encodeURIComponent(taskId)}`,
    UpdatedTask,
    { body: { userId } },
  );
});

export const createComment = Effect.fnUntraced(function* (
  taskId: string,
  content: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    `/api/comment/${encodeURIComponent(taskId)}`,
    CreatedComment,
    { body: { content } },
  );
});
