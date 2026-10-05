import { and, eq, exists, isNull, or } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

function getLabelsByWorkspaceId(workspaceId: string, userId: string) {
  return db
    .select()
    .from(labelTable)
    .where(
      and(
        eq(labelTable.workspaceId, workspaceId),
        or(
          isNull(labelTable.taskId),
          exists(
            db
              .select({ id: taskTable.id })
              .from(taskTable)
              .where(
                and(
                  eq(taskTable.id, labelTable.taskId),
                  projectAccessCondition(userId, taskTable.projectId),
                ),
              ),
          ),
        ),
      ),
    );
}

export default getLabelsByWorkspaceId;
