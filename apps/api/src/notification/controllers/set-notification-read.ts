import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import type { PermissionMap } from "../../utils/role-permissions";
import { notificationReadAccess } from "../resource-access";

async function setNotificationRead(
  id: string,
  userId: string,
  isRead: boolean,
  apiKeyPermissions?: PermissionMap | null,
) {
  const access = await notificationReadAccess(
    userId,
    notificationTable.resourceId,
    notificationTable.resourceType,
    apiKeyPermissions,
  );
  const [notification] = await db
    .update(notificationTable)
    .set({ isRead })
    .where(
      and(
        eq(notificationTable.id, id),
        eq(notificationTable.userId, userId),
        access,
      ),
    )
    .returning();

  if (!notification) {
    throw new HTTPException(404, {
      message: "Notification not found",
    });
  }

  return notification;
}

export default setNotificationRead;
