import { and, eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import { notificationResourceAccess } from "../resource-access";
import { notificationWorkspaceFilter } from "../workspace-filter";

async function markAllNotificationsAsRead(
  userId: string,
  workspaceId?: string,
) {
  await db
    .update(notificationTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationTable.userId, userId),
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

export default markAllNotificationsAsRead;
