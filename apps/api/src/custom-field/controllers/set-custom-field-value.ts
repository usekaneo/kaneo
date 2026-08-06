import { and, eq } from "drizzle-orm";
import db from "../../database";
import { customFieldValueTable } from "../../database/schema";

async function setCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string,
) {
  const [existing] = await db
    .select()
    .from(customFieldValueTable)
    .where(
      and(
        eq(customFieldValueTable.taskId, taskId),
        eq(customFieldValueTable.fieldId, fieldId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(customFieldValueTable)
      .set({ value })
      .where(eq(customFieldValueTable.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(customFieldValueTable)
    .values({ taskId, fieldId, value })
    .returning();

  return inserted;
}

export default setCustomFieldValue;
