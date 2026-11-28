import { type RefObject, useLayoutEffect, useState } from "react";
import type { GanttTimeline } from "./timeline.js";

export function usePixelsPerDay(
  trackRef: RefObject<HTMLDivElement | null>,
  timeline: GanttTimeline,
) {
  const [pixelsPerDay, setPixelsPerDay] = useState(44);

  useLayoutEffect(() => {
    const element = trackRef.current;
    if (!element) return;

    const update = () => {
      const count = timeline.days.length;
      if (count <= 0) return;
      setPixelsPerDay(element.clientWidth / count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [trackRef, timeline]);

  return pixelsPerDay;
}
