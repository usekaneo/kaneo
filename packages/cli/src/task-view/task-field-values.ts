import { Effect, Schema } from "effect";
import { KaneoApi } from "../api/kaneo-api.js";

export const TaskFieldValue = Schema.Struct({
  fieldId: Schema.String,
  value: Schema.NullOr(Schema.String),
  fieldName: Schema.String,
  fieldType: Schema.String,
  fieldPosition: Schema.Number,
});
export type TaskFieldValue = typeof TaskFieldValue.Type;

const TaskFieldValueList = Schema.Array(TaskFieldValue);

export const listTaskFieldValuesWithNames = Effect.fnUntraced(function* (
  taskId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/custom-field/task/${encodeURIComponent(taskId)}`,
    TaskFieldValueList,
  );
});
