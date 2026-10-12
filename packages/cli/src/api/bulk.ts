import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

export type BulkOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

export const BulkResult = Schema.Struct({
  success: Schema.Boolean,
  updatedCount: Schema.Number,
});
export type BulkResult = typeof BulkResult.Type;

export const bulkUpdateTasks = Effect.fnUntraced(function* (body: {
  readonly taskIds: ReadonlyArray<string>;
  readonly operation: BulkOperation;
  readonly value?: string | null;
}) {
  const api = yield* KaneoApi;
  return yield* api.request("PATCH", "/api/task/bulk", BulkResult, { body });
});
