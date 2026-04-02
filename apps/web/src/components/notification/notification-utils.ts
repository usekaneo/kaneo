import type { TFunction } from "i18next";
import { getStatusLabel } from "@/lib/i18n/domain";
import type { Notification } from "@/types/notification";

export type NotificationTarget =
  | {
      commentId?: string;
      kind: "task";
      projectId: string;
      taskId: string;
      workspaceId: string;
    }
  | {
      kind: "workspace";
      workspaceId: string;
    }
  | null;

export function getEventDataRecord(
  eventData: unknown,
): Record<string, unknown> | null {
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return null;
  }

  return eventData as Record<string, unknown>;
}

function getEventString(
  eventData: Record<string, unknown> | null,
  key: string,
) {
  const value = eventData?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getNotificationTitle(notification: Notification, t: TFunction) {
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
      case "task_comment_created":
        return t("notifications:events.task_comment_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "time_entry_created":
        return t("notifications:events.time_entry_created.title", {
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
  t: TFunction,
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
      case "task_comment_created":
        return t("notifications:events.task_comment_created.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "time_entry_created":
        return getEventString(eventData, "taskTitle")
          ? t("notifications:events.time_entry_created.contentWithTask", {
              ...eventData,
              defaultValue: notification.content ?? "",
            })
          : t("notifications:events.time_entry_created.contentWithoutTask", {
              ...eventData,
              defaultValue: notification.content ?? "",
            });
      default:
        break;
    }
  }

  return notification.content ?? "";
}

export function getNotificationWorkspaceId(notification: Notification) {
  const eventData = getEventDataRecord(notification.eventData);
  const eventWorkspaceId = getEventString(eventData, "workspaceId");

  if (eventWorkspaceId) {
    return eventWorkspaceId;
  }

  if (notification.resourceType === "workspace" && notification.resourceId) {
    return notification.resourceId;
  }

  return undefined;
}

export function notificationMatchesWorkspace(
  notification: Notification,
  workspaceId: string,
) {
  return getNotificationWorkspaceId(notification) === workspaceId;
}

export function getNotificationProjectName(notification: Notification) {
  const eventData = getEventDataRecord(notification.eventData);
  return getEventString(eventData, "projectName");
}

export function getNotificationTarget(
  notification: Notification,
  fallbackWorkspaceId?: string,
): NotificationTarget {
  const eventData = getEventDataRecord(notification.eventData);
  const workspaceId =
    getEventString(eventData, "workspaceId") ?? fallbackWorkspaceId;

  if (notification.resourceType === "workspace") {
    const workspaceTarget = notification.resourceId ?? workspaceId;

    if (!workspaceTarget) {
      return null;
    }

    return {
      kind: "workspace",
      workspaceId: workspaceTarget,
    };
  }

  const projectId = getEventString(eventData, "projectId");
  const taskId =
    getEventString(eventData, "taskId") ?? notification.resourceId ?? undefined;

  if (!workspaceId || !projectId || !taskId) {
    return null;
  }

  return {
    kind: "task",
    workspaceId,
    projectId,
    taskId,
    commentId: getEventString(eventData, "commentId"),
  };
}

export function focusNotificationComment(commentId?: string) {
  if (!commentId) {
    return;
  }

  const targetId = `comment-${commentId}`;

  const scrollToComment = (attempt = 0) => {
    const element = document.getElementById(targetId);

    if (element) {
      window.location.hash = targetId;
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    if (attempt < 6) {
      window.setTimeout(() => {
        scrollToComment(attempt + 1);
      }, 180);
    }
  };

  window.setTimeout(() => {
    scrollToComment();
  }, 120);
}
