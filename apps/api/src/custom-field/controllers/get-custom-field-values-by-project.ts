import { eq } from "drizzle-orm";
import { Effect } from "effect";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";
import { Database } from "../../effect/database";

const getCustomFieldValuesByProject = Effect.fn(
  "customField.getCustomFieldValuesByProject",
)(function* (projectId: string) {
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
      .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
      .innerJoin(
        customFieldDefinitionTable,
        eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
      )
      .where(eq(taskTable.projectId, projectId)),
  );
});

export default getCustomFieldValuesByProject;
