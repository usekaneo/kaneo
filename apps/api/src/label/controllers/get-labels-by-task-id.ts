import { Effect } from "effect";
import { Database } from "../../effect/database";

const getLabelsByTaskId = Effect.fn("label.getLabelsByTaskId")(function* (
  taskId: string,
) {
  const database = yield* Database;

  return yield* database.query((db) =>
    db.query.labelTable.findMany({
      where: (label, { eq }) => eq(label.taskId, taskId),
    }),
  );
});

export default getLabelsByTaskId;
