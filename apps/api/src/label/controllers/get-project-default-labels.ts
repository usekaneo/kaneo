import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import {
  labelTable,
  projectDefaultLabelTable,
  projectTable,
} from "../../database/schema";

// A project moved to another workspace keeps rows whose labels stay behind;
// only labels from the project's own workspace count.
export function getProjectDefaultLabels(projectId: string) {
  return db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
    })
    .from(projectDefaultLabelTable)
    .innerJoin(
      projectTable,
      eq(projectTable.id, projectDefaultLabelTable.projectId),
    )
    .innerJoin(
      labelTable,
      and(
        eq(labelTable.id, projectDefaultLabelTable.labelId),
        eq(labelTable.workspaceId, projectTable.workspaceId),
      ),
    )
    .where(
      and(
        eq(projectDefaultLabelTable.projectId, projectId),
        isNull(labelTable.taskId),
        isNull(labelTable.deletionStartedAt),
      ),
    )
    .orderBy(asc(labelTable.name), asc(labelTable.id));
}
