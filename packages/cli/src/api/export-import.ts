import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const ExportedTask = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  status: Schema.String,
  priority: Schema.String,
  dueDate: NullableString,
  startDate: NullableString,
  userId: NullableString,
  labels: Schema.Array(
    Schema.Struct({ name: Schema.String, color: Schema.String }),
  ),
});
export type ExportedTask = typeof ExportedTask.Type;

export const TaskExport = Schema.Struct({
  project: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
    description: NullableString,
    exportedAt: Schema.String,
  }),
  tasks: Schema.Array(ExportedTask),
});
export type TaskExport = typeof TaskExport.Type;

export type ImportTaskBody = {
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly priority?: string;
  readonly startDate?: string | null;
  readonly dueDate?: string | null;
  readonly userId?: string | null;
};

export const ImportOutcome = Schema.Struct({
  success: Schema.Boolean,
  error: Schema.optionalKey(Schema.String),
  warnings: Schema.optionalKey(Schema.Array(Schema.String)),
  task: Schema.Struct({
    id: Schema.optionalKey(Schema.String),
    number: Schema.optionalKey(Schema.NullOr(Schema.Number)),
    title: Schema.String,
    status: Schema.optionalKey(Schema.String),
  }),
});
export type ImportOutcome = typeof ImportOutcome.Type;

export const ImportResult = Schema.Struct({
  results: Schema.Struct({
    total: Schema.Number,
    successful: Schema.Number,
    failed: Schema.Number,
    tasks: Schema.Array(ImportOutcome),
  }),
});
export type ImportResult = typeof ImportResult.Type;

export const exportTasks = Effect.fnUntraced(function* (projectId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/task/export/${encodeURIComponent(projectId)}`,
    TaskExport,
  );
});

export const importTasks = Effect.fnUntraced(function* (
  projectId: string,
  tasks: ReadonlyArray<ImportTaskBody>,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    `/api/task/import/${encodeURIComponent(projectId)}`,
    ImportResult,
    { body: { tasks } },
  );
});
