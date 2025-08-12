import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

async function getNotifications(userId: string) {
  const notifications = await db
    .select()
    .from(notificationTable)
    .where(eq(notificationTable.userId, userId))
    .orderBy(desc(notificationTable.createdAt))
    .limit(50);

  return notifications;
}

export default getNotifications;
