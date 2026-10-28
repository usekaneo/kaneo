import { and, eq, not } from "drizzle-orm";
import db from "../database";
import {
  userNotificationWorkspaceProjectTable,
  userNotificationWorkspaceRuleTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

export async function findHiddenRuleProjectIds(
  userId: string,
  workspaceId: string,
): Promise<string[]> {
  const rows = await db
    .select({ projectId: userNotificationWorkspaceProjectTable.projectId })
    .from(userNotificationWorkspaceProjectTable)
    .innerJoin(
      userNotificationWorkspaceRuleTable,
      eq(
        userNotificationWorkspaceRuleTable.id,
        userNotificationWorkspaceProjectTable.workspaceRuleId,
      ),
    )
    .where(
      and(
        eq(userNotificationWorkspaceRuleTable.userId, userId),
        eq(userNotificationWorkspaceRuleTable.workspaceId, workspaceId),
        not(
          projectAccessCondition(
            userId,
            userNotificationWorkspaceProjectTable.projectId,
          ),
        ),
      ),
    );
  return rows.map((row) => row.projectId);
}
