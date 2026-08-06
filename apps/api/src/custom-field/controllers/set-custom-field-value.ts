import { eq, sql } from "drizzle-orm";
import db from "../../database";
import { customFieldValueTable } from "../../database/schema";

async function setCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string,
) {
  const [result] = await db
    .insert(customFieldValueTable)
    .values({ taskId, fieldId, value })
    .onConflictDoUpdate({
      target: [customFieldValueTable.taskId, customFieldValueTable.fieldId],
      set: {
        value: sql`excluded.value`,
      },
    })
    .returning();

  return result;
}

export default setCustomFieldValue;