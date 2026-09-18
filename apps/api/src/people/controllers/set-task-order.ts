import { and, eq, inArray, sql } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTaskOrderTable,
} from "../../database/schema";

// Replaces the person's whole My work order in this workspace. The list is
// small (their open tasks plus recent done ones), so rewriting it is simpler
// and safer than patching positions. Ids outside the workspace are dropped.
async function setTaskOrder(
  workspaceId: string,
  userId: string,
  taskIds: string[],
) {
  const unique = [...new Set(taskIds)];
  const known = unique.length
    ? await db
        .select({ id: taskTable.id })
        .from(taskTable)
        .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
        .where(
          and(
            inArray(taskTable.id, unique),
            eq(projectTable.workspaceId, workspaceId),
          ),
        )
    : [];
  const allowed = new Set(known.map((row) => row.id));
  const ordered = unique.filter((id) => allowed.has(id));

  await db.transaction(async (tx) => {
    // Quick successive drags send overlapping rewrites; without the lock two
    // delete-then-insert runs can collide on the primary key.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1525, hashtext(${`${userId}:${workspaceId}`}))`,
    );
    await tx
      .delete(userTaskOrderTable)
      .where(
        and(
          eq(userTaskOrderTable.userId, userId),
          eq(userTaskOrderTable.workspaceId, workspaceId),
        ),
      );
    if (ordered.length) {
      await tx.insert(userTaskOrderTable).values(
        ordered.map((taskId, position) => ({
          userId,
          taskId,
          workspaceId,
          position,
        })),
      );
    }
  });

  return { taskIds: ordered };
}

export default setTaskOrder;
