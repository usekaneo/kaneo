import { useEffect, useState } from "react";

export function useCompletionLinger(active: boolean, durationMs: number) {
  const [previous, setPrevious] = useState(active);
  const [lingering, setLingering] = useState(false);

  if (active !== previous) {
    setPrevious(active);
    setLingering(previous && !active);
  }

  useEffect(() => {
    if (!lingering) return;
    const timer = window.setTimeout(() => setLingering(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [lingering, durationMs]);

  return lingering;
}
