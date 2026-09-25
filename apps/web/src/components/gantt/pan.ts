// Pure helper for panning the Gantt chart by dragging an empty area: turns a
// pointer's total movement since the drag started into the scroll
// container's next scrollLeft/scrollTop. Dragging right moves the visible
// content right (the natural "grab and pull" direction), which is why the
// deltas are subtracted rather than added.

export type PanScrollPosition = { scrollLeft: number; scrollTop: number };

export function computePanScrollPosition(params: {
  startScrollLeft: number;
  startScrollTop: number;
  deltaX: number;
  deltaY: number;
}): PanScrollPosition {
  const { startScrollLeft, startScrollTop, deltaX, deltaY } = params;
  return {
    scrollLeft: startScrollLeft - deltaX,
    scrollTop: startScrollTop - deltaY,
  };
}
