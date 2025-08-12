import { eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

async function clearNotifications(userId: string) {
  await db
    .delete(notificationTable)
    .where(eq(notificationTable.userId, userId));

  return { success: true };
}

export default clearNotifications;
