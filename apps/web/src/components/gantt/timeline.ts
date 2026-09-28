import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";

export const GANTT_WINDOW_DAYS = 91;
const minimumDate = parseISO("0001-01-01");
const maximumDate = parseISO("9999-12-31");

export function parseTaskDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ||
    parsed < minimumDate ||
    startOfDay(parsed) > maximumDate
    ? null
    : parsed;
}

function clampDate(date: Date, minimum: Date, maximum: Date) {
  return new Date(
    Math.max(minimum.getTime(), Math.min(date.getTime(), maximum.getTime())),
  );
}

export function buildGanttTimeline(
  tasks: { scheduleStart: Date; scheduleEnd: Date }[],
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  dayColumnWidthRem: number,
  requestedStart: Date | null = null,
  today: Date = new Date(),
) {
  if (tasks.length === 0) return null;
  let earliest = tasks[0].scheduleStart;
  let latest = tasks[0].scheduleEnd;
  for (const task of tasks) {
    if (task.scheduleStart < earliest) earliest = task.scheduleStart;
    if (task.scheduleEnd > latest) latest = task.scheduleEnd;
  }
  const minimumStart = clampDate(
    subDays(startOfWeek(earliest, { weekStartsOn }), 7),
    minimumDate,
    maximumDate,
  );
  const maximumEnd = clampDate(
    startOfDay(addDays(endOfWeek(latest, { weekStartsOn }), 28)),
    minimumDate,
    maximumDate,
  );
  const maximumStart = new Date(
    Math.max(
      minimumStart.getTime(),
      subDays(maximumEnd, GANTT_WINDOW_DAYS - 1).getTime(),
    ),
  );
  const fits =
    differenceInCalendarDays(maximumEnd, minimumStart) < GANTT_WINDOW_DAYS;
  const anchor = today >= earliest && today <= latest ? today : earliest;
  const defaultStart = fits
    ? minimumStart
    : subDays(startOfWeek(anchor, { weekStartsOn }), 7);
  const rangeStart = startOfDay(
    clampDate(
      requestedStart && !Number.isNaN(requestedStart.getTime())
        ? requestedStart
        : defaultStart,
      minimumStart,
      maximumStart,
    ),
  );
  const rangeEnd = clampDate(
    addDays(rangeStart, GANTT_WINDOW_DAYS - 1),
    rangeStart,
    maximumEnd,
  );
  // Bound BEFORE allocating Date objects or grid columns, including old/imported
  // tasks whose dates were never checked by today's API validation.
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  return {
    days,
    rangeStart,
    rangeEnd,
    minimumStart,
    maximumStart,
    hasPrevious: rangeStart > minimumStart,
    hasNext: rangeEnd < maximumEnd,
    gridTemplateColumns: `repeat(${days.length}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
    timelineMinWidthRem: days.length * dayColumnWidthRem,
  };
}
