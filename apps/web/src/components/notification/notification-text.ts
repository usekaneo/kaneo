import { getStatusLabel } from "@/lib/i18n/domain";
import type { Notification } from "@/types/notification";

export function getEventDataRecord(
  eventData: unknown,
): Record<string, unknown> | null {
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return null;
  }

  return eventData as Record<string, unknown>;
}

function getReminderLeadTime(
  eventData: Record<string, unknown>,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const minutes = Number(eventData.leadTimeMinutes ?? 1440);
  if (minutes % 1440 === 0) {
    return t("notifications:reminderLeadTime.days", {
      count: minutes / 1440,
    });
  }
  if (minutes % 60 === 0) {
    return t("notifications:reminderLeadTime.hours", {
      count: minutes / 60,
    });
  }
  return t("notifications:reminderLeadTime.minutes", { count: minutes });
}

export function getNotificationTitle(
  notification: Notification,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const eventData = getEventDataRecord(notification.eventData);
  if (eventData) {
    switch (notification.type) {
      case "task_created":
        return t("notifications:events.task_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "workspace_created":
        return t("notifications:events.workspace_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_status_changed":
        return t("notifications:events.task_status_changed.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_assignee_changed":
        return t("notifications:events.task_assignee_changed.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "time_entry_created":
        return t("notifications:events.time_entry_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_mention":
        return t("notifications:events.task_mention.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_comment":
        return t("notifications:events.task_comment.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "due_date_reminder":
        return t("notifications:events.due_date_reminder.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_overdue":
        return t("notifications:events.task_overdue.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      default:
        break;
    }
  }

  return notification.title ?? notification.type;
}

export function getNotificationContent(
  notification: Notification,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const eventData = getEventDataRecord(notification.eventData);
  if (eventData) {
    switch (notification.type) {
      case "task_created":
        return t("notifications:events.task_created.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "workspace_created":
        return t("notifications:events.workspace_created.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "task_status_changed":
        return t("notifications:events.task_status_changed.content", {
          ...eventData,
          oldStatus: getStatusLabel(String(eventData.oldStatus ?? "")),
          newStatus: getStatusLabel(String(eventData.newStatus ?? "")),
          defaultValue: notification.content ?? "",
        });
      case "task_assignee_changed":
        return t("notifications:events.task_assignee_changed.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "time_entry_created":
        return eventData.taskTitle
          ? t("notifications:events.time_entry_created.contentWithTask", {
              ...eventData,
              defaultValue: notification.content ?? "",
            })
          : t("notifications:events.time_entry_created.contentWithoutTask", {
              ...eventData,
              defaultValue: notification.content ?? "",
            });
      case "task_mention":
        return t("notifications:events.task_mention.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "task_comment":
        return t("notifications:events.task_comment.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "due_date_reminder":
        return t("notifications:events.due_date_reminder.content", {
          ...eventData,
          leadTime: getReminderLeadTime(eventData, t),
          defaultValue: notification.content ?? "",
        });
      case "task_overdue":
        return t("notifications:events.task_overdue.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      default:
        break;
    }
  }

  return notification.content ?? "";
}
