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

// WheelEvent.deltaMode values (not read from the DOM WheelEvent constants so
// this stays usable in a non-DOM test environment): most browsers/mice
// report DOM_DELTA_PIXEL, but Firefox reports DOM_DELTA_LINE for a physical
// mouse wheel, and DOM_DELTA_PAGE shows up for some trackpad/OS gestures.
// `deltaY` is only pixels in the first mode — treating it as pixels in the
// other two either barely moves the zoom (line mode, deltaY of ~3) or slams
// it straight to the clamp (page mode, deltaY of ~1).
// DOM_DELTA_PIXEL (0) needs no case: it's the `default`, since deltaY is
// already pixels in that mode.
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

// An approximate CSS line-height in pixels, used to convert a line-mode
// delta to pixels; browsers don't expose the actual value a line-mode event
// was computed from.
const WHEEL_LINE_HEIGHT_PX = 16;

// Converts a wheel event's deltaY to an equivalent pixel delta based on its
// deltaMode, so `nextGanttZoom` always receives a pixel-scale value
// regardless of which mode the browser reported.
export function normalizeWheelDeltaY(
  deltaY: number,
  deltaMode: number,
  viewportHeightPx: number,
): number {
  switch (deltaMode) {
    case DOM_DELTA_LINE:
      return deltaY * WHEEL_LINE_HEIGHT_PX;
    case DOM_DELTA_PAGE:
      return deltaY * viewportHeightPx;
    default:
      return deltaY;
  }
}

export function clampGanttZoom(zoom: number): number {
  return Math.min(MAX_GANTT_ZOOM, Math.max(MIN_GANTT_ZOOM, zoom));
}

// Whether a wheel event should drive Gantt zoom rather than be left alone
// for the browser's own native scroll. A trackpad's two-finger horizontal
// swipe is a scroll gesture, not a zoom one — it reports a deltaX-dominant
// event, and treating it as zoom (which preventDefaults the event) would
// also block native horizontal scrolling over the timeline. A vertical
// wheel (the common case: a physical mouse wheel, which never reports
// deltaX, or a trackpad's vertical swipe) or an explicit ctrl+wheel (the
// standard trackpad-pinch/ctrl-zoom signal browsers report) is the "clear
// zoom gesture" that should actually zoom.
export function isZoomWheelGesture(
  deltaX: number,
  deltaY: number,
  ctrlKey: boolean,
): boolean {
  if (ctrlKey) return true;
  return Math.abs(deltaY) >= Math.abs(deltaX);
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
