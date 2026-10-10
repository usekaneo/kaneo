import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const Label = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: Schema.String,
  taskId: NullableString,
  workspaceId: NullableString,
  deletionStartedAt: Schema.optionalKey(NullableString),
});
export type Label = typeof Label.Type;

export const LabelList = Schema.Array(Label);

export const LabelDeletion = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  pendingDeletion: Schema.optionalKey(Schema.Boolean),
});
export type LabelDeletion = typeof LabelDeletion.Type;

function labelPath(id: string, suffix = ""): string {
  return `/api/label/${encodeURIComponent(id)}${suffix}`;
}

export const listWorkspaceLabels = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/label/workspace/${encodeURIComponent(workspaceId)}`,
    LabelList,
  );
});

export const listTaskLabels = Effect.fnUntraced(function* (taskId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/label/task/${encodeURIComponent(taskId)}`,
    LabelList,
  );
});

export const createLabel = Effect.fnUntraced(function* (body: {
  readonly workspaceId: string;
  readonly name: string;
  readonly color: string;
}) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/label", Label, { body });
});

export const updateLabel = Effect.fnUntraced(function* (
  id: string,
  body: { readonly name: string; readonly color: string },
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", labelPath(id), Label, { body });
});

export const deleteLabelStep = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request("DELETE", labelPath(id), LabelDeletion);
});

export const attachLabelToTask = Effect.fnUntraced(function* (
  workspaceLabelId: string,
  taskId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    labelPath(workspaceLabelId, "/task"),
    Label,
    {
      body: { taskId },
    },
  );
});

export const detachLabelFromTask = Effect.fnUntraced(function* (
  taskLabelId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("DELETE", labelPath(taskLabelId, "/task"), Label);
});
