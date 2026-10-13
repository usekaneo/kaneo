import { isSameDay } from "date-fns";
import type { Notification } from "@/types/notification";

export type InboxFilter = "all" | "unread" | "mentions";

export function filterNotifications(
  notifications: Notification[],
  filter: InboxFilter,
) {
  if (filter === "unread") {
    return notifications.filter((notification) => !notification.isRead);
  }
  if (filter === "mentions") {
    return notifications.filter(
      (notification) => notification.type === "task_mention",
    );
  }
  return notifications;
}

export function groupNotifications(
  notifications: Notification[],
  now = new Date(),
) {
  const today: Notification[] = [];
  const earlier: Notification[] = [];

  for (const notification of notifications) {
    if (isSameDay(new Date(notification.createdAt), now)) {
      today.push(notification);
    } else {
      earlier.push(notification);
    }
  }

  return { today, earlier };
}
