import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

export const ACTIVITY_LIMIT_MAX = 100;

const NullableString = Schema.NullOr(Schema.String);

export const TaskActivity = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  createdAt: Schema.String,
  userId: NullableString,
  content: NullableString,
  eventData: Schema.optionalKey(Schema.Unknown),
  externalUserName: Schema.optionalKey(NullableString),
});
export type TaskActivity = typeof TaskActivity.Type;

export const TaskActivityList = Schema.Array(TaskActivity);

export const listTaskActivity = Effect.fnUntraced(function* (
  taskId: string,
  limit: number | undefined,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/activity/${encodeURIComponent(taskId)}`,
    TaskActivityList,
    { query: { limit } },
  );
});
