import { eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

async function markAllNotificationsAsRead(userEmail: string) {
  await db
    .update(notificationTable)
    .set({ isRead: true })
    .where(eq(notificationTable.userEmail, userEmail));

  return { success: true };
}

export default markAllNotificationsAsRead;
