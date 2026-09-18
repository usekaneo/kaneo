import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { customFieldDefinitionTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { CustomFieldNotInProject } from "../errors";

const reorderCustomFields = Effect.fn("customField.reorderCustomFields")(
  function* (
    projectId: string,
    customFields: Array<{ id: string; position: number }>,
  ) {
    const database = yield* Database;

    yield* database.transaction((tx) =>
      Effect.gen(function* () {
        for (const field of customFields) {
          const [updated] = yield* tx.query((db) =>
            db
              .update(customFieldDefinitionTable)
              .set({ position: field.position })
              .where(
                and(
                  eq(customFieldDefinitionTable.id, field.id),
                  eq(customFieldDefinitionTable.projectId, projectId),
                ),
              )
              .returning({ id: customFieldDefinitionTable.id }),
          );

          if (!updated) {
            return yield* new CustomFieldNotInProject({
              id: field.id,
              projectId,
            });
          }
        }
      }),
    );

    return yield* database.query((db) =>
      db.query.customFieldDefinitionTable.findMany({
        where: eq(customFieldDefinitionTable.projectId, projectId),
        orderBy: (columns, { asc }) => [asc(columns.position)],
      }),
    );
  },
);

export default reorderCustomFields;
