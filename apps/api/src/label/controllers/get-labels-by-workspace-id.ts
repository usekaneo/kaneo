import { and, eq, isNull, or } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskTable } from "../../database/schema";
import { visibleTaskFilter } from "../../utils/task-visibility";

async function getLabelsByWorkspaceId(
  workspaceId: string,
  assigneeId?: string,
) {
  if (!assigneeId) {
    return db
      .select()
      .from(labelTable)
      .where(eq(labelTable.workspaceId, workspaceId));
  }

  const rows = await db
    .select({ label: labelTable })
    .from(labelTable)
    .leftJoin(taskTable, eq(labelTable.taskId, taskTable.id))
    .where(
      and(
        eq(labelTable.workspaceId, workspaceId),
        or(isNull(labelTable.taskId), visibleTaskFilter(assigneeId)),
      ),
    );
  return rows.map((row) => row.label);
}

export default getLabelsByWorkspaceId;
