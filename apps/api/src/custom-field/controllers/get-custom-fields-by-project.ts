import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { customFieldDefinitionTable } from "../../database/schema";
import { Database } from "../../effect/database";

const getCustomFieldsByProject = Effect.fn(
  "customField.getCustomFieldsByProject",
)(function* (projectId: string) {
  const database = yield* Database;

  return yield* database.query((db) =>
    db
      .select()
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.projectId, projectId))
      .orderBy(asc(customFieldDefinitionTable.position)),
  );
});

export default getCustomFieldsByProject;
