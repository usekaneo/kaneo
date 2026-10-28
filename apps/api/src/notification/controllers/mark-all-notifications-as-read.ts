import { and, eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import type { PermissionMap } from "../../utils/role-permissions";
import { notificationReadAccess } from "../resource-access";
import { notificationWorkspaceFilter } from "../workspace-filter";

async function markAllNotificationsAsRead(
  userId: string,
  workspaceId?: string,
  apiKeyPermissions?: PermissionMap | null,
) {
  const access = await notificationReadAccess(
    userId,
    notificationTable.resourceId,
    notificationTable.resourceType,
    apiKeyPermissions,
    workspaceId,
  );
  await db
    .update(notificationTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationTable.userId, userId),
        notificationWorkspaceFilter(workspaceId),
        access,
      ),
    );

  return { success: true };
}

export default markAllNotificationsAsRead;
