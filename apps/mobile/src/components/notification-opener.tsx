import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

/** Opens the task behind a tapped system notification. */
export function NotificationOpener({ enabled }: { enabled: boolean }) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    // Handle each tap once, and drop taps made while signed out, so a later sign-in never
    // replays a notification from an earlier session.
    handled.current = id;
    Notifications.clearLastNotificationResponse();
    const taskId = response.notification.request.content.data?.taskId;
    if (enabled && typeof taskId === "string")
      router.push({ pathname: "/task/[taskId]", params: { taskId } });
  }, [response, enabled]);
  return null;
}
