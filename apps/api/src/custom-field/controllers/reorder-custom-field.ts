import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customFieldDefinitionTable } from "../../database/schema";

async function reorderCustomFields(
  projectId: string,
  customFields: Array<{ id: string; position: number }>,
) {
  await db.transaction(async (tx) => {
    // Match creation/duplication lock order before applying the requested display order.
    await tx
      .select({ id: customFieldDefinitionTable.id })
      .from(customFieldDefinitionTable)
      .where(
        and(
          eq(customFieldDefinitionTable.projectId, projectId),
          inArray(
            customFieldDefinitionTable.id,
            customFields.map((field) => field.id),
          ),
        ),
      )
      .orderBy(customFieldDefinitionTable.id)
      .for("update");
    for (const field of customFields) {
      const [updated] = await tx
        .update(customFieldDefinitionTable)
        .set({ position: field.position })
        .where(
          and(
            eq(customFieldDefinitionTable.id, field.id),
            eq(customFieldDefinitionTable.projectId, projectId),
          ),
        )
        .returning({ id: customFieldDefinitionTable.id });

      if (!updated) {
        throw new HTTPException(400, {
          message: `Custom field ${field.id} does not belong to this project`,
        });
      }
    }
  });

  const updated = await db.query.customFieldDefinitionTable.findMany({
    where: eq(customFieldDefinitionTable.projectId, projectId),
    orderBy: (columns, { asc }) => [asc(columns.position)],
  });

  return updated;
}

export default reorderCustomFields;
