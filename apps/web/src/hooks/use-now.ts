import { useEffect, useState } from "react";

// Re-renders every `intervalMs` while `active`, for live timers. Idle views
// don't tick at all.
export function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
