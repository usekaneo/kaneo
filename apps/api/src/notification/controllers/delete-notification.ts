import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import type { PermissionMap } from "../../utils/role-permissions";
import { notificationReadAccess } from "../resource-access";

async function deleteNotification(
  id: string,
  userId: string,
  apiKeyPermissions?: PermissionMap | null,
) {
  const access = await notificationReadAccess(
    userId,
    notificationTable.resourceId,
    notificationTable.resourceType,
    apiKeyPermissions,
  );
  const [deleted] = await db
    .delete(notificationTable)
    .where(
      and(
        eq(notificationTable.id, id),
        eq(notificationTable.userId, userId),
        access,
      ),
    )
    .returning({ id: notificationTable.id });

  if (!deleted) {
    throw new HTTPException(404, {
      message: "Notification not found",
    });
  }

  return { success: true };
}

export default deleteNotification;
