import { createId } from "@paralleldrive/cuid2";
import db from "../../database";
import { notificationTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deliverNotification } from "../../notification-preferences/delivery";

import { safeOutboundError } from "../../utils/outbound-request";
import { canReceiveResourceNotification } from "../resource-access";

export async function persistNotification(
  {
    userId,
    title,
    content,
    type,
    eventData,
    resourceId,
    resourceType,
  }: {
    userId: string;
    title?: string | null;
    content?: string | null;
    type?: string;
    eventData?: Record<string, unknown> | null;
    resourceId?: string;
    resourceType?: string;
  },
  database: Pick<typeof db, "query" | "insert" | "select"> = db,
) {
  if (
    !(await canReceiveResourceNotification(
      userId,
      resourceId,
      resourceType,
      database,
    ))
  ) {
    return null;
  }

  const preferenceKey =
    type === "task_assignee_changed" || type === "task_created"
      ? "taskAssignmentEnabled"
      : type === "task_comment" || type === "task_mention"
        ? "taskCommentEnabled"
        : type === "task_status_changed"
          ? "taskStatusChangeEnabled"
          : type === "due_date_reminder" || type === "task_overdue"
            ? "dueDateReminderEnabled"
            : null;

  if (preferenceKey) {
    const preference =
      await database.query.userNotificationPreferenceTable.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
      });

    if (preference?.[preferenceKey] === false) {
      return null;
    }
  }

  const [notification] = await database
    .insert(notificationTable)
    .values({
      id: createId(),
      userId,
      title: title ?? null,
      content: content ?? null,
      type: type || "info",
      eventData: eventData ?? null,
      resourceId: resourceId || null,
      resourceType: resourceType || null,
    })
    .returning();

  return notification;
}

export async function dispatchNotification(
  notification: typeof notificationTable.$inferSelect,
) {
  await publishEvent("notification.created", {
    notificationId: notification.id,
    userId: notification.userId,
  });
  void deliverNotification(notification.id).catch((error) => {
    console.error("Failed to deliver notification", {
      notificationId: notification.id,
      error: safeOutboundError(error),
    });
  });
}

async function createNotification(
  data: Parameters<typeof persistNotification>[0],
) {
  const notification = await persistNotification(data);
  if (notification) await dispatchNotification(notification);
  return notification;
}

export default createNotification;
