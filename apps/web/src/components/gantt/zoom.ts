// Pure math for the Gantt chart's wheel-driven zoom: how a wheel event's
// deltaY turns into a new zoom factor, and how to adjust horizontal scroll
// so the calendar day under the pointer stays under the pointer once the
// day-column width changes. Kept free of the DOM so it's unit-testable
// without a real layout.

export const MIN_GANTT_ZOOM = 0.4;
export const MAX_GANTT_ZOOM = 3;

// How much one mouse-wheel "notch" (~100 deltaY units in most browsers)
// changes the zoom factor. Exponential rather than linear so the same notch
// always feels like the same relative step, near the minimum or the maximum.
const ZOOM_SENSITIVITY = 0.0015;

export function clampGanttZoom(zoom: number): number {
  return Math.min(MAX_GANTT_ZOOM, Math.max(MIN_GANTT_ZOOM, zoom));
}

// `deltaY > 0` (scrolling down/away) zooms out; `deltaY < 0` zooms in — the
// same direction convention as maps and code editors.
export function nextGanttZoom(currentZoom: number, deltaY: number): number {
  return clampGanttZoom(currentZoom * Math.exp(-deltaY * ZOOM_SENSITIVITY));
}

/**
 * The scroll container's next `scrollLeft` that keeps the calendar day under
 * the pointer visually fixed while the day-column width changes.
 *
 * The timeline's day columns start `railWidthPx` pixels into the scrollable
 * content (the sticky task rail's rendered width, which doesn't scale with
 * zoom) — only the position *within* the day-grid scales by
 * `newZoom / oldZoom`; the rail region itself stays put.
 *
 * `pointerX` must be in the scroll container's own viewport coordinates
 * (`event.clientX - container.getBoundingClientRect().left`), since
 * `scrollLeft` is relative to that container, not the page.
 */
export function scrollLeftForZoom(params: {
  scrollLeft: number;
  pointerX: number;
  railWidthPx: number;
  oldZoom: number;
  newZoom: number;
}): number {
  const { scrollLeft, pointerX, railWidthPx, oldZoom, newZoom } = params;
  if (oldZoom <= 0) return scrollLeft;
  const dayContentX = scrollLeft + pointerX - railWidthPx;
  const scaledDayContentX = dayContentX * (newZoom / oldZoom);
  return railWidthPx + scaledDayContentX - pointerX;
}
