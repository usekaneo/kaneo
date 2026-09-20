import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { Effect } from "effect";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";
import { Database } from "../../effect/database";

const getCustomFieldFilterValues = Effect.fn(
  "customField.getCustomFieldFilterValues",
)(function* (projectId: string) {
  const database = yield* Database;

  const fields = yield* database.query((db) =>
    db
      .select()
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.projectId, projectId)),
  );

  if (fields.length === 0) {
    return [];
  }

  const rows = yield* database.query((db) =>
    db
      .selectDistinct({
        fieldId: customFieldValueTable.fieldId,
        value: customFieldValueTable.value,
      })
      .from(customFieldValueTable)
      .where(
        and(
          inArray(
            customFieldValueTable.fieldId,
            fields.map((field) => field.id),
          ),
          isNotNull(customFieldValueTable.value),
          ne(customFieldValueTable.value, ""),
        ),
      ),
  );

  const valuesByField = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = valuesByField.get(row.fieldId) ?? [];
    bucket.push(row.value as string);
    valuesByField.set(row.fieldId, bucket);
  }

  return fields.map((field) => ({
    fieldId: field.id,
    fieldName: field.name,
    fieldType: field.type,
    values: valuesByField.get(field.id) ?? [],
  }));
});

export default getCustomFieldFilterValues;
