import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import db from "../../database";
import {
  notificationTable,
  projectTable,
  taskTable,
} from "../../database/schema";

async function getNotifications(userId: string) {
  const notifications = await db
    .select({
      id: notificationTable.id,
      userId: notificationTable.userId,
      title: notificationTable.title,
      content: notificationTable.content,
      type: notificationTable.type,
      isRead: notificationTable.isRead,
      resourceId: notificationTable.resourceId,
      resourceType: notificationTable.resourceType,
      createdAt: notificationTable.createdAt,
    })
    .from(notificationTable)
    .leftJoin(
      taskTable,
      and(
        eq(notificationTable.resourceType, "task"),
        eq(notificationTable.resourceId, taskTable.id),
      ),
    )
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(notificationTable.userId, userId),
        or(
          ne(notificationTable.resourceType, "task"),
          isNull(projectTable.archivedAt),
        ),
      ),
    )
    .orderBy(desc(notificationTable.createdAt))
    .limit(50);

  return notifications;
}

export default getNotifications;
