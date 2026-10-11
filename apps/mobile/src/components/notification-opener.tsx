import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

/** Opens the task behind a tapped system notification. */
export function NotificationOpener({ enabled }: { enabled: boolean }) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const taskId = response?.notification.request.content.data?.taskId;
    if (enabled && typeof taskId === "string")
      router.push({ pathname: "/task/[taskId]", params: { taskId } });
  }, [response, enabled]);
  return null;
}
