import { and, eq, isNotNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";

export default async function getCustomFieldFilterValues(projectId: string) {
  const fields = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const result = await Promise.all(
    fields.map(async (field) => {
      const rawValues = await db
        .selectDistinct({ value: customFieldValueTable.value })
        .from(customFieldValueTable)
        .where(
          and(
            eq(customFieldValueTable.fieldId, field.id),
            isNotNull(customFieldValueTable.value),
            ne(customFieldValueTable.value, ""),
          ),
        );

      return {
        fieldId: field.id,
        fieldName: field.name,
        fieldType: field.type,
        values: rawValues.map((r) => r.value as string),
      };
    }),
  );

  return result;
}
