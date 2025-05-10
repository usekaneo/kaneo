import { eq } from "drizzle-orm";
import db from "../../database";
import { notificationTable } from "../../database/schema";

async function clearNotifications(userEmail: string) {
  await db
    .delete(notificationTable)
    .where(eq(notificationTable.userEmail, userEmail));

  return { success: true };
}

export default clearNotifications;
