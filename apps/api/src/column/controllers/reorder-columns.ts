import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { columnTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { ColumnNotInProject } from "../errors";

const reorderColumns = Effect.fn("column.reorderColumns")(function* (
  projectId: string,
  columns: Array<{ id: string; position: number }>,
) {
  const database = yield* Database;

  for (const col of columns) {
    const [updated] = yield* database.query((db) =>
      db
        .update(columnTable)
        .set({ position: col.position })
        .where(
          and(eq(columnTable.id, col.id), eq(columnTable.projectId, projectId)),
        )
        .returning({ id: columnTable.id }),
    );

    if (!updated) {
      return yield* new ColumnNotInProject({ id: col.id, projectId });
    }
  }

  return yield* database.query((db) =>
    db.query.columnTable.findMany({
      where: eq(columnTable.projectId, projectId),
      orderBy: (columns, { asc }) => [asc(columns.position)],
    }),
  );
});

export default reorderColumns;
