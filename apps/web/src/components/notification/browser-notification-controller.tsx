import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import markNotificationAsRead from "@/fetchers/notification/mark-notification-as-read";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import {
  getBrowserNotificationPermission,
  shouldEmitBrowserNotification,
  showBrowserNotification,
} from "@/lib/browser-notifications";
import {
  playNotificationSound,
  primeNotificationSound,
} from "@/lib/notification-sound";
import queryClient from "@/query-client";
import type { Notification } from "@/types/notification";
import {
  focusNotificationComment,
  getNotificationContent,
  getNotificationTarget,
  getNotificationTitle,
} from "./notification-utils";

async function openNotificationTarget(
  notification: Notification,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (!notification.isRead) {
    try {
      await markNotificationAsRead(notification.id);
      await queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  const target = getNotificationTarget(notification);

  if (target?.kind === "task") {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId: target.workspaceId,
        projectId: target.projectId,
      },
      search: {
        taskId: target.taskId,
      },
    });
    focusNotificationComment(target.commentId);
    return;
  }

  if (target?.kind === "workspace") {
    navigate({
      to: "/dashboard/workspace/$workspaceId/my-tasks",
      params: {
        workspaceId: target.workspaceId,
      },
    });
  }
}

export default function BrowserNotificationController() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: notifications } = useGetNotifications();
  const hasInitializedRef = useRef(false);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const primeSound = () => {
      void primeNotificationSound();
    };

    window.addEventListener("pointerdown", primeSound, {
      passive: true,
    });
    window.addEventListener("keydown", primeSound);

    return () => {
      window.removeEventListener("pointerdown", primeSound);
      window.removeEventListener("keydown", primeSound);
    };
  }, []);

  const showDesktopNotification = useCallback(
    (notification: Notification) => {
      if (!notification.id || !shouldEmitBrowserNotification(notification.id)) {
        return;
      }

      showBrowserNotification({
        title: getNotificationTitle(notification, t),
        body: getNotificationContent(notification, t) || undefined,
        icon: `${window.location.origin}/favicon-96x96.png`,
        tag: notification.id,
        onClick: () => {
          window.focus();
          void openNotificationTarget(notification, navigate);
        },
      });
    },
    [navigate, t],
  );

  useEffect(() => {
    if (!notifications) {
      return;
    }

    const currentNotificationIds = new Set(
      notifications
        .map((notification) => notification.id)
        .filter((notificationId): notificationId is string =>
          Boolean(notificationId),
        ),
    );

    const sortedNotifications = notifications
      .map((notification) => ({
        createdAt: new Date(notification.createdAt).getTime(),
        notification,
      }))
      .filter(({ createdAt }) => Number.isFinite(createdAt));

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      knownNotificationIdsRef.current = currentNotificationIds;
      return;
    }

    const newNotifications = sortedNotifications
      .filter(
        ({ notification }) =>
          notification.id &&
          !knownNotificationIdsRef.current.has(notification.id),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ notification }) => notification);

    if (newNotifications.length > 0) {
      void playNotificationSound();
    }

    if (getBrowserNotificationPermission() === "granted") {
      for (const notification of newNotifications) {
        showDesktopNotification(notification);
      }
    }

    knownNotificationIdsRef.current = currentNotificationIds;
  }, [notifications, showDesktopNotification]);

  return null;
}
