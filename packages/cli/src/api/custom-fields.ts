import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const CustomField = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  name: Schema.String,
  type: Schema.String,
  required: Schema.Boolean,
  defaultValue: NullableString,
  options: Schema.NullOr(Schema.Unknown),
});
export type CustomField = typeof CustomField.Type;

const CustomFieldList = Schema.Array(CustomField);

export const CustomFieldValue = Schema.Struct({
  fieldId: Schema.String,
  value: NullableString,
});
export type CustomFieldValue = typeof CustomFieldValue.Type;

const CustomFieldValueList = Schema.Array(CustomFieldValue);

const SavedValue = Schema.Struct({
  fieldId: Schema.String,
  value: NullableString,
});

export const listCustomFields = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/custom-field/project/${encodeURIComponent(projectId)}`,
    CustomFieldList,
  );
});

export const createCustomField = Effect.fnUntraced(function* (body: {
  readonly projectId: string;
  readonly name: string;
  readonly type: string;
  readonly options?: ReadonlyArray<string>;
}) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/custom-field", CustomField, {
    body,
  });
});

export const deleteCustomField = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "DELETE",
    `/api/custom-field/${encodeURIComponent(id)}`,
    CustomField,
  );
});

export const listTaskFieldValues = Effect.fnUntraced(function* (
  taskId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/custom-field/task/${encodeURIComponent(taskId)}`,
    CustomFieldValueList,
  );
});

export const setTaskFieldValue = Effect.fnUntraced(function* (body: {
  readonly taskId: string;
  readonly fieldId: string;
  readonly value: string;
}) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", "/api/custom-field/value", SavedValue, {
    body,
  });
});
