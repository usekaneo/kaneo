import { eq } from "drizzle-orm";
import { Effect } from "effect";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";
import { Database } from "../../effect/database";

const getCustomFieldValuesByTask = Effect.fn(
  "customField.getCustomFieldValuesByTask",
)(function* (taskId: string) {
  const database = yield* Database;

  return yield* database.query((db) =>
    db
      .select({
        id: customFieldValueTable.id,
        taskId: customFieldValueTable.taskId,
        fieldId: customFieldValueTable.fieldId,
        value: customFieldValueTable.value,
        fieldName: customFieldDefinitionTable.name,
        fieldPosition: customFieldDefinitionTable.position,
        fieldType: customFieldDefinitionTable.type,
        fieldOptions: customFieldDefinitionTable.options,
      })
      .from(customFieldValueTable)
      .innerJoin(
        customFieldDefinitionTable,
        eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
      )
      .where(eq(customFieldValueTable.taskId, taskId)),
  );
});

export default getCustomFieldValuesByTask;
