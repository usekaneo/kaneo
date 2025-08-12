import { createId } from "@paralleldrive/cuid2";
import db from "../../database";
import { notificationTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createNotification({
  userId,
  title,
  content,
  type,
  resourceId,
  resourceType,
}: {
  userId: string;
  title: string;
  content?: string;
  type?: string;
  resourceId?: string;
  resourceType?: string;
}) {
  const [notification] = await db
    .insert(notificationTable)
    .values({
      id: createId(),
      userId,
      title,
      content: content || "",
      type: type || "info",
      resourceId: resourceId || null,
      resourceType: resourceType || null,
    })
    .returning();

  if (notification) {
    await publishEvent("notification.created", {
      notificationId: notification.id,
      userId,
    });
  }

  return notification;
}

export default createNotification;
