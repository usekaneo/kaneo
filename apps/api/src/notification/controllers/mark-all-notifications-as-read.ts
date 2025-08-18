import { eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

async function markAllNotificationsAsRead(userId: string) {
  await db
    .update(notificationTable)
    .set({ isRead: true })
    .where(eq(notificationTable.userId, userId));

  return { success: true };
}

export default markAllNotificationsAsRead;
