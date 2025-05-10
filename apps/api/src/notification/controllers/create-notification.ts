import { createId } from "@paralleldrive/cuid2";
import db from "../../database";
import { notificationTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createNotification({
  userEmail,
  title,
  content,
  type,
  resourceId,
  resourceType,
}: {
  userEmail: string;
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
      userEmail,
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
      userEmail,
    });
  }

  return notification;
}

export default createNotification;
