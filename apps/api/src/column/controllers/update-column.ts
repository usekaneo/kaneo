import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { columnTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { columnById } from "../../effect/lookups";
import { ColumnUpdateFailed } from "../errors";

const updateColumn = Effect.fn("column.updateColumn")(function* (
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
  },
) {
  const database = yield* Database;

  yield* columnById(id);

  const [updated] = yield* database.query((db) =>
    db
      .update(columnTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
      })
      .where(eq(columnTable.id, id))
      .returning(),
  );

  if (!updated) {
    return yield* new ColumnUpdateFailed({ id });
  }

  return updated;
});

export default updateColumn;
