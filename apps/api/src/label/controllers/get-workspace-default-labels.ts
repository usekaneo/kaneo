import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import {
  labelTable,
  projectDefaultLabelTable,
  projectTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

// Every project's default labels in one query, for the sidebar's project list.
export function getWorkspaceDefaultLabels(workspaceId: string, userId: string) {
  return db
    .select({
      projectId: projectDefaultLabelTable.projectId,
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
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
        isNull(labelTable.taskId),
        isNull(labelTable.deletionStartedAt),
      ),
    )
    .orderBy(asc(labelTable.name), asc(labelTable.id));
}
