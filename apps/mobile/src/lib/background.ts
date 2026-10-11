import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";

import { api } from "./api/endpoints";
import { describeNotification } from "./describe";
import { parseInstant } from "./format";
import { sessionStore } from "./session";

/**
 * Kaneo has no mobile push service, so unread notifications are polled in the background
 * (the OS runs this at most every 15 minutes) and surfaced as local notifications.
 */
export const BACKGROUND_TASK = "kaneo-notifications";
const SINCE_KEY = "kaneo.notifications.since";
const CHANNEL_ID = "kaneo_activity";
const MAX_POSTED = 5;

export async function checkNotifications(): Promise<void> {
  if (!sessionStore.get().ready) await sessionStore.hydrate();
  if (!sessionStore.get().session) return;
  const since = Number((await AsyncStorage.getItem(SINCE_KEY)) ?? 0);
  const notifications = await api.notifications();
  const unread = notifications
    .filter(
      (n) =>
        n.isRead !== true &&
        (parseInstant(n.createdAt)?.getTime() ?? 0) > since,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // On the first run only remember where we are, so the existing backlog isn't replayed.
  if (since !== 0 && AppState.currentState !== "active") {
    for (const n of unread.slice(-MAX_POSTED)) {
      const text = describeNotification(n);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: text.title,
          body: text.body ?? undefined,
          data:
            n.resourceType === "task" && n.resourceId
              ? { taskId: n.resourceId }
              : {},
        },
        trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
      });
    }
  }
  const newest = Math.max(
    0,
    ...notifications.map((n) => parseInstant(n.createdAt)?.getTime() ?? 0),
  );
  await AsyncStorage.setItem(
    SINCE_KEY,
    String(Math.max(since, newest || Date.now())),
  );
}

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    await checkNotifications();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function setupNotificationChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Kaneo activity",
      description: "Assignments, comments and mentions from your workspaces",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  await setupNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function setBackgroundChecks(enabled: boolean) {
  const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
  if (enabled && !registered) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: 15,
    });
  } else if (!enabled && registered) {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK);
    await AsyncStorage.removeItem(SINCE_KEY);
  }
}
