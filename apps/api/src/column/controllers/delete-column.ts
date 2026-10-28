import { publishEvent } from "../../events";
import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";

async function deleteColumn(id: string) {
  const existing = await db.transaction(async (tx) => {
    // Lock before checking emptiness so queued deletes see committed inserts.
    const [column] = await tx
      .select()
      .from(columnTable)
      .where(eq(columnTable.id, id))
      .limit(1)
      .for("update");

    if (!column) {
      throw new HTTPException(404, { message: "Column not found" });
    }

    const [taskCount] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(taskTable)
      .where(eq(taskTable.columnId, id));

    if (taskCount && taskCount.count > 0) {
      throw new HTTPException(409, {
        message:
          "Cannot delete column that contains tasks. Move or delete tasks first.",
      });
    }

    await tx.delete(columnTable).where(eq(columnTable.id, id));
    return column;
  });

  await publishEvent("project.updated", { projectId: existing.projectId });

  return existing;
}

export default deleteColumn;
