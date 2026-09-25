import { useEffect, useState } from "react";

/**
 * Ticks once a second from a server-stamped start time. The interval is
 * cleared on unmount and paused while the tab is hidden, so no background
 * timer leaks. The server timestamp stays authoritative; this is display only.
 */
export function useElapsed(startTime: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startTime) return;

    setNow(Date.now());

    const tick = () => setNow(Date.now());
    const handleVisibility = () => {
      if (!document.hidden) {
        tick();
      }
    };

    const interval = setInterval(() => {
      if (!document.hidden) {
        tick();
      }
    }, 1000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startTime]);

  if (!startTime) return 0;
  return Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
}
