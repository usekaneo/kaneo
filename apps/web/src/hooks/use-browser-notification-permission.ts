import { useCallback, useEffect, useState } from "react";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  subscribeToBrowserNotificationPermissionChange,
} from "@/lib/browser-notifications";

function useBrowserNotificationPermission() {
  const [permission, setPermission] = useState(() =>
    getBrowserNotificationPermission(),
  );

  useEffect(() => {
    const syncPermission = () => {
      setPermission(getBrowserNotificationPermission());
    };

    const unsubscribe =
      subscribeToBrowserNotificationPermissionChange(syncPermission);

    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const nextPermission = await requestBrowserNotificationPermission();
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  return {
    supported: permission !== "unsupported",
    permission,
    requestPermission,
  };
}

export default useBrowserNotificationPermission;
