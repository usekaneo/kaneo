import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { columnTable } from "../../database/schema";
import { Database } from "../../effect/database";

const getColumns = Effect.fn("column.getColumns")(function* (
  projectId: string,
) {
  const database = yield* Database;

  return yield* database.query((db) =>
    db
      .select()
      .from(columnTable)
      .where(eq(columnTable.projectId, projectId))
      .orderBy(asc(columnTable.position)),
  );
});

export default getColumns;
