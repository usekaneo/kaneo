import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import {
  labelTable,
  pinnedLabelTable,
  workspaceUserTable,
} from "../../database/schema";

// Pins outlive a membership; only labels from current workspaces are listed.
function getPinnedLabels(userId: string) {
  return db
    .selectDistinct({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
      workspaceId: labelTable.workspaceId,
      pinnedAt: pinnedLabelTable.createdAt,
    })
    .from(pinnedLabelTable)
    .innerJoin(labelTable, eq(labelTable.id, pinnedLabelTable.labelId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, labelTable.workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .where(
      and(
        eq(pinnedLabelTable.userId, userId),
        isNull(labelTable.taskId),
        isNull(labelTable.deletionStartedAt),
      ),
    )
    .orderBy(asc(pinnedLabelTable.createdAt), asc(labelTable.id))
    .then((rows) => rows.map(({ pinnedAt: _, ...label }) => label));
}

export default getPinnedLabels;
