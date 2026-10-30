import { and, eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import type { PermissionMap } from "../../utils/role-permissions";
import { notificationReadAccess } from "../resource-access";
import { notificationWorkspaceFilter } from "../workspace-filter";

async function clearNotifications(
  userId: string,
  workspaceId?: string,
  onlyRead = false,
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
    .delete(notificationTable)
    .where(
      and(
        eq(notificationTable.userId, userId),
        onlyRead ? eq(notificationTable.isRead, true) : undefined,
        notificationWorkspaceFilter(workspaceId),
        access,
      ),
    );

  return { success: true };
}

export default clearNotifications;
