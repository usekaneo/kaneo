import { addDays, differenceInCalendarDays } from "date-fns";

export type DragKind = "start" | "end" | "move";

export type DateRange = { start: Date; end: Date };

export function dragRange(
  kind: DragKind,
  initial: DateRange,
  days: readonly Date[],
  rangeStart: Date,
  deltaX: number,
  pixelsPerDay: number,
): DateRange {
  const deltaDays = Math.round(deltaX / pixelsPerDay);
  const startIndex = differenceInCalendarDays(initial.start, rangeStart);
  const endIndex = differenceInCalendarDays(initial.end, rangeStart);

  if (kind === "start") {
    const nextIndex = Math.max(0, Math.min(startIndex + deltaDays, endIndex));
    return { start: days[nextIndex] ?? initial.start, end: initial.end };
  }

  if (kind === "end") {
    const nextIndex = Math.max(
      startIndex,
      Math.min(endIndex + deltaDays, days.length - 1),
    );
    return { start: initial.start, end: days[nextIndex] ?? initial.end };
  }

  const durationDays = differenceInCalendarDays(initial.end, initial.start);
  const nextIndex = Math.max(
    0,
    Math.min(startIndex + deltaDays, days.length - 1 - durationDays),
  );
  const start = days[nextIndex] ?? initial.start;
  return { start, end: addDays(start, durationDays) };
}
