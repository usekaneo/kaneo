import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customFieldDefinitionTable } from "../../database/schema";

async function reorderCustomFields(
  projectId: string,
  customFields: Array<{ id: string; position: number }>,
) {
  for (const col of customFields) {
    const [updated] = await db
      .update(customFieldDefinitionTable)
      .set({ position: col.position })
      .where(
        and(eq(customFieldDefinitionTable.id, col.id), eq(customFieldDefinitionTable.projectId, projectId)),
      )
      .returning({ id: customFieldDefinitionTable.id });

    if (!updated) {
      throw new HTTPException(400, {
        message: `Column ${col.id} does not belong to this project`,
      });
    }
  }

  const updated = await db.query.customFieldDefinitionTable.findMany({
    where: eq(customFieldDefinitionTable.projectId, projectId),
    orderBy: (columns, { asc }) => [asc(columns.position)],
  });

  return updated;
}

export default reorderCustomFields;
