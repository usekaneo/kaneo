import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import { notificationResourceAccess } from "../resource-access";

async function setNotificationRead(
  id: string,
  userId: string,
  isRead: boolean,
) {
  const [notification] = await db
    .update(notificationTable)
    .set({ isRead })
    .where(
      and(
        eq(notificationTable.id, id),
        eq(notificationTable.userId, userId),
        notificationResourceAccess(
          userId,
          notificationTable.resourceId,
          notificationTable.resourceType,
        ),
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
