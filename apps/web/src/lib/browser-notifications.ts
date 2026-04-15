const BROWSER_NOTIFICATION_PERMISSION_EVENT =
  "browser-notification-permission-change";

const RECENT_BROWSER_NOTIFICATION_IDS_KEY = "browser-notification:recent-ids";

const RECENT_BROWSER_NOTIFICATION_TTL_MS = 60_000;

export type BrowserNotificationPermission =
  | NotificationPermission
  | "unsupported";

type ShowBrowserNotificationOptions = {
  body?: string;
  icon?: string;
  onClick?: () => void;
  tag?: string;
  title: string;
};

export type ShowBrowserNotificationResult =
  | {
      notification: Notification;
      status: "shown";
    }
  | {
      reason: "permission_not_granted" | "unsupported";
      status: "skipped";
    }
  | {
      error: unknown;
      status: "error";
    };

function dispatchBrowserNotificationPermissionChange(
  permission: BrowserNotificationPermission,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(BROWSER_NOTIFICATION_PERMISSION_EVENT, {
      detail: permission,
    }),
  );
}

function pruneRecentNotificationIds(
  records: Record<string, number>,
  now: number,
) {
  return Object.fromEntries(
    Object.entries(records).filter(
      ([, createdAt]) => now - createdAt < RECENT_BROWSER_NOTIFICATION_TTL_MS,
    ),
  );
}

function readRecentNotificationIds() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(
      RECENT_BROWSER_NOTIFICATION_IDS_KEY,
    );

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => key && typeof value === "number",
      ),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeRecentNotificationIds(records: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      RECENT_BROWSER_NOTIFICATION_IDS_KEY,
      JSON.stringify(records),
    );
  } catch {
    // Ignore storage failures and fall back to in-memory dedupe within the tab.
  }
}

export function isBrowserNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!isBrowserNotificationSupported()) {
    return "unsupported";
  }

  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) {
    return "unsupported" as const;
  }

  const permission = await window.Notification.requestPermission();
  dispatchBrowserNotificationPermissionChange(permission);
  return permission;
}

export function subscribeToBrowserNotificationPermissionChange(
  listener: () => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(BROWSER_NOTIFICATION_PERMISSION_EVENT, listener);

  return () => {
    window.removeEventListener(BROWSER_NOTIFICATION_PERMISSION_EVENT, listener);
  };
}

export function shouldEmitBrowserNotification(notificationId: string) {
  if (!notificationId) {
    return false;
  }

  const now = Date.now();
  const recentNotificationIds = pruneRecentNotificationIds(
    readRecentNotificationIds(),
    now,
  );

  if (recentNotificationIds[notificationId]) {
    writeRecentNotificationIds(recentNotificationIds);
    return false;
  }

  recentNotificationIds[notificationId] = now;
  writeRecentNotificationIds(recentNotificationIds);

  return true;
}

export function showBrowserNotification({
  body,
  icon,
  onClick,
  tag,
  title,
}: ShowBrowserNotificationOptions) {
  const permission = getBrowserNotificationPermission();

  if (permission === "unsupported") {
    return {
      status: "skipped" as const,
      reason: "unsupported" as const,
    };
  }

  if (permission !== "granted") {
    return {
      status: "skipped" as const,
      reason: "permission_not_granted" as const,
    };
  }

  try {
    const notification = new window.Notification(title, {
      body,
      icon,
      requireInteraction: true,
      tag,
    });

    if (onClick) {
      notification.onclick = () => {
        onClick();
        notification.close();
      };
    }

    return {
      status: "shown" as const,
      notification,
    };
  } catch (error) {
    console.error("Failed to show browser notification:", error);
    return {
      status: "error" as const,
      error,
    };
  }
}
