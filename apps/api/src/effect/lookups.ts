import { Effect } from "effect";
import { findLabel, findTaskRef } from "../database/lookups";
import { Database, type DatabaseExecutor } from "./database";
import { NotFound } from "./errors";

export const labelById = Effect.fn("lookups.labelById")(function* (
  id: string,
  tx?: DatabaseExecutor,
) {
  const database = tx ?? (yield* Database);
  const label = yield* database.query((db) => findLabel(id, db));

  if (!label) {
    return yield* new NotFound({ entity: "Label", id });
  }

  return label;
});

export const taskRefById = Effect.fn("lookups.taskRefById")(function* (
  taskId: string,
  tx?: DatabaseExecutor,
) {
  const database = tx ?? (yield* Database);
  const [task] = yield* database.query((db) => findTaskRef(taskId, db));

  if (!task) {
    return yield* new NotFound({ entity: "Task", id: taskId });
  }

  return task;
});
