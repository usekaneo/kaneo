import { and, eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import { notificationResourceAccess } from "../resource-access";
import { notificationWorkspaceFilter } from "../workspace-filter";

async function clearNotifications(
  userId: string,
  workspaceId?: string,
  onlyRead = false,
) {
  await db
    .delete(notificationTable)
    .where(
      and(
        eq(notificationTable.userId, userId),
        onlyRead ? eq(notificationTable.isRead, true) : undefined,
        notificationWorkspaceFilter(workspaceId),
        workspaceId
          ? notificationResourceAccess(
              userId,
              notificationTable.resourceId,
              notificationTable.resourceType,
            )
          : undefined,
      ),
    );

  return { success: true };
}

export default clearNotifications;
