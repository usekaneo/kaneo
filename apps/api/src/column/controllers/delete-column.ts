import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { columnTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { columnById } from "../../effect/lookups";
import { ColumnHasTasks } from "../errors";

const deleteColumn = Effect.fn("column.deleteColumn")(function* (id: string) {
  const database = yield* Database;

  const existing = yield* columnById(id);

  const [taskCount] = yield* database.query((db) =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(taskTable)
      .where(eq(taskTable.columnId, id)),
  );

  if (taskCount && taskCount.count > 0) {
    return yield* new ColumnHasTasks({ id, count: taskCount.count });
  }

  yield* database.query((db) =>
    db.delete(columnTable).where(eq(columnTable.id, id)),
  );

  return existing;
});

export default deleteColumn;
