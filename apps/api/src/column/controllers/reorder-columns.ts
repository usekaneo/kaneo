import { publishEvent } from "../../events";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";

async function reorderColumns(
  projectId: string,
  columns: Array<{ id: string; position: number }>,
) {
  const updated = await db.transaction(async (tx) => {
    for (const col of [...columns].sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      const [updated] = await tx
        .update(columnTable)
        .set({ position: col.position })
        .where(
          and(eq(columnTable.id, col.id), eq(columnTable.projectId, projectId)),
        )
        .returning({ id: columnTable.id });

      if (!updated) {
        throw new HTTPException(400, {
          message: `Column ${col.id} does not belong to this project`,
        });
      }
    }

    return tx.query.columnTable.findMany({
      where: eq(columnTable.projectId, projectId),
      orderBy: (columns, { asc }) => [asc(columns.position)],
    });
  });

  await publishEvent("project.updated", { projectId });

  return updated;
}

export default reorderColumns;
