import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
} from "date-fns";

export const GANTT_WINDOW_DAYS = 91;

// The timeline's granularity. The underlying grid stays per-day at every
// unit (see buildGanttGridMetrics/getBarGridColumns below) — only the visible
// window length, the day-column width the caller picks, and the header's
// grouping change. That's what lets a task starting mid-week or mid-month
// still land at its exact proportional position: a "week" column is just
// seven ordinary day-tracks placed under one label.
export type GanttUnit = "day" | "week" | "month" | "quarter";

// Single source of truth for "every unit, in display order" — the Gantt
// route's segmented control iterates this to render its buttons, and the
// user-preferences store's persisted-value guard (isGanttUnit) validates
// against it; previously each kept its own separately-typed copy of the same
// four literals.
export const GANTT_UNITS: readonly GanttUnit[] = [
  "day",
  "week",
  "month",
  "quarter",
];

// How a Gantt bar renders relative to a hovered dependency: dimmed/
// highlighted when hovering a bar connected to it by an edge, normal
// otherwise. Shared by every bar variant (own/summary/external) rather than
// each declaring its own identical union.
export type GanttBarEmphasis = "normal" | "highlighted" | "dimmed";

// Bars render with `mx-1` (0.25rem — see gantt-task-bar.tsx /
// gantt-external-task-bar.tsx), so the visible edge sits inset from the
// grid-column boundary a box's left/right are otherwise measured against;
// without this a dependency line lands a few pixels short of (or past) the
// bar it's supposed to touch. 0.25rem scales with the root font size, so the
// inset is measured from it rather than assumed to be the default 16px (4px)
// — otherwise it drifts out of alignment under a non-default browser/OS
// font-size setting.
export function getBarEdgeInsetPx(): number {
  if (typeof document === "undefined") return 4;
  const rootFontSizePx = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return (Number.isFinite(rootFontSizePx) ? rootFontSizePx : 16) * 0.25;
}

// The smallest on-screen width (px) a bar's box is allowed to end up at,
// regardless of how narrow the day-column grid gets. Month/Quarter can
// compress a single day-track down to a fraction of a pixel, at which point
// the usual edge inset alone (see getBarEdgeInsetPx) would eat the entire
// track — the bar would render with zero (or negative, before clamping)
// content width, i.e. invisible, and a dependency-line box built from the
// same two numbers would invert (right < left). Clamping both the bar's own
// rendered box and its dependency-line box to this minimum keeps a
// single-day task visible (if slightly wider than its literal day-track) and
// keeps the box's left/right from ever inverting.
export const MIN_BAR_CONTENT_PX = 6;

// Turns a grid track's raw pixel bounds (before inset) into the bar's actual
// rendered/measured box: the usual inset on each side, shrunk (never
// negative) so the box never ends up narrower than MIN_BAR_CONTENT_PX. Used
// both for the bar's own visual margin/min-width and for the pixel box the
// dependency-line overlay measures it by, so the two always agree on where
// the bar's edges actually are.
export function computeInsetBarBox(
  trackLeftPx: number,
  trackRightPx: number,
  desiredInsetPx: number,
): { left: number; right: number; insetPx: number } {
  const grossWidth = trackRightPx - trackLeftPx;
  const insetPx = Math.max(
    0,
    Math.min(desiredInsetPx, (grossWidth - MIN_BAR_CONTENT_PX) / 2),
  );
  const left = trackLeftPx + insetPx;
  const right = Math.max(left + MIN_BAR_CONTENT_PX, trackRightPx - insetPx);
  return { left, right, insetPx };
}

// Roughly how much history+future a full window shows at each unit, chosen
// so the chart stays readable rather than either cramped or mostly empty:
// Day ~13 weeks, Week ~6 months, Month ~1.5 years, Quarter ~3 years. These
// are day-count approximations (months/quarters vary in length), used only
// to size the window and page it — the header's own column boundaries
// (buildGanttHeaderColumns below) still land on real calendar weeks/months/
// quarters regardless of this approximation.
export const GANTT_UNIT_WINDOW_DAYS: Record<GanttUnit, number> = {
  day: GANTT_WINDOW_DAYS,
  week: 182, // 26 weeks
  month: 548, // ~18 months
  quarter: 1096, // ~12 quarters
};

const minimumDate = parseISO("0001-01-01");
const maximumDate = parseISO("9999-12-31");

// Shared by the task bar and the dependency-line overlay: which grid lines
// (1-indexed, CSS Grid style) a task's schedule occupies in the current
// window, and whether any part of it falls inside that window at all.
export function getBarGridColumns(
  scheduleStart: Date,
  scheduleEnd: Date,
  rangeStart: Date,
  trackCount: number,
): { barInView: boolean; lineStart: number; lineEnd: number } {
  const startIndex = differenceInCalendarDays(scheduleStart, rangeStart);
  const endIndex = differenceInCalendarDays(scheduleEnd, rangeStart);
  const barInView = endIndex >= 0 && startIndex < trackCount && trackCount > 0;
  if (!barInView) {
    return { barInView: false, lineStart: 1, lineEnd: 1 };
  }
  const lineStart = Math.max(1, Math.min(startIndex + 1, trackCount));
  const lineEnd = Math.max(
    lineStart + 1,
    Math.min(endIndex + 2, trackCount + 1),
  );
  return { barInView: true, lineStart, lineEnd };
}

// The progress-fill width, as a percentage of the bar's VISIBLE (window-
// clipped) box — i.e. what a caller should actually set the fill div's
// `width: %` to — representing true progress over the task's FULL span
// rather than a percentage of the clipped box itself. A long task whose bar
// extends past either window edge would otherwise have its fill computed
// against just the visible sliver, showing far more (or less) of the bar
// filled than the task's real progress: e.g. a task 10% done, entirely past
// the window's right edge so only its tail 5% is visible, would render as
// 10% of that tiny visible sliver filled — which visually reads as "100% of
// the way across what's on screen" rather than "10% of the whole task".
// `visibleLineStart`/`visibleLineEnd` are the bar's own (already
// window-clipped) `getBarGridColumns` result for the same schedule.
export function computeProgressFillPercent(
  progress: number,
  scheduleStart: Date,
  scheduleEnd: Date,
  rangeStart: Date,
  visibleLineStart: number,
  visibleLineEnd: number,
): number {
  const visibleSpan = visibleLineEnd - visibleLineStart;
  if (visibleSpan <= 0) return 0;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const startIndex = differenceInCalendarDays(scheduleStart, rangeStart);
  const endIndex = differenceInCalendarDays(scheduleEnd, rangeStart);
  const fullLineStart = startIndex + 1;
  // Mirrors getBarGridColumns' own lineEnd >= lineStart + 1 guard (a
  // single-day task still has a positive span to compute a fraction of).
  const fullLineEnd = Math.max(fullLineStart + 1, endIndex + 2);
  const totalSpan = fullLineEnd - fullLineStart;

  const progressLine = fullLineStart + (clampedProgress / 100) * totalSpan;
  const clippedProgressLine = Math.min(
    visibleLineEnd,
    Math.max(visibleLineStart, progressLine),
  );
  return ((clippedProgressLine - visibleLineStart) / visibleSpan) * 100;
}

export function parseTaskDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ||
    parsed < minimumDate ||
    startOfDay(parsed) > maximumDate
    ? null
    : parsed;
}

// Shared by the Gantt route for both the project's own tasks and related
// tasks pulled in from other projects: a task with only one of
// startDate/dueDate is scheduled as a single-day bar on that date, and a
// task with neither has no usable schedule at all (the caller skips it).
export function deriveTaskSchedule(
  startDate: string | null,
  dueDate: string | null,
): { start: Date; end: Date } | null {
  const parsedStart = parseTaskDate(startDate) ?? parseTaskDate(dueDate);
  const parsedEnd = parseTaskDate(dueDate) ?? parseTaskDate(startDate);
  if (!parsedStart || !parsedEnd) return null;

  return {
    start: parsedStart <= parsedEnd ? parsedStart : parsedEnd,
    end: parsedEnd >= parsedStart ? parsedEnd : parsedStart,
  };
}

function clampDate(date: Date, minimum: Date, maximum: Date) {
  return new Date(
    Math.max(minimum.getTime(), Math.min(date.getTime(), maximum.getTime())),
  );
}

// Snaps an explicitly requested window start (typing a date, paging, jumping
// to a task) onto that unit's natural boundary, so switching units — or
// paging within one — always lands on a whole week/month/quarter rather than
// a start date that cuts one off partway through. The auto-computed default
// window (no requested start) is left week-aligned regardless of unit; a
// slightly partial first month/quarter column there reads as normal padding,
// not a bug, the same way Day mode already starts a week before the
// earliest task.
export function alignRangeStartToUnit(
  date: Date,
  unit: GanttUnit,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
): Date {
  switch (unit) {
    case "week":
      return startOfWeek(date, { weekStartsOn });
    case "month":
      return startOfMonth(date);
    case "quarter":
      return startOfQuarter(date);
    default:
      return date;
  }
}

// The date window itself (which days are in view, and the paging bounds
// around them) depends only on the task list, the week-start preference,
// and which page is requested — never on the day-column width. Splitting it
// out from `buildGanttTimeline` lets a caller memoize it separately from
// zoom, so wheel-zooming (which only changes `dayColumnWidthRem`) doesn't
// re-run `eachDayOfInterval` and allocate a fresh 91-day `Date[]` on every
// wheel notch.
export function buildGanttRange(
  tasks: { scheduleStart: Date; scheduleEnd: Date }[],
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  requestedStart: Date | null = null,
  today: Date = new Date(),
  unit: GanttUnit = "day",
  // Widens the paging bounds (minimumStart/maximumStart/maximumEnd) so a
  // date outside `tasks`' own span is still reachable via paging, the date
  // picker, or a "show task dates" jump — without moving anchor/defaultStart
  // (the page shown with no explicit request), which stay based on `tasks`
  // alone. The Gantt route passes its external (cross-project) related
  // tasks here: they get their own row, but the window would otherwise never
  // be able to scroll to one dated outside this project's own tasks.
  extraBoundsTasks: { scheduleStart: Date; scheduleEnd: Date }[] = [],
) {
  // A project can have externally-related (cross-project) rows to show even
  // when it has no scheduled tasks of its own — falling back to
  // extraBoundsTasks here (rather than bailing out to `null`, which the
  // Gantt route treats as "nothing to show at all") is what lets those rows
  // still get a timeline to render on. `fits`/`anchor`/`defaultStart` below
  // stay derived from whichever list actually anchors the window, same as
  // before; this only changes what happens when `tasks` (this project's own)
  // is empty.
  const anchorTasks = tasks.length > 0 ? tasks : extraBoundsTasks;
  if (anchorTasks.length === 0) return null;
  const windowDays = GANTT_UNIT_WINDOW_DAYS[unit];
  let earliest = anchorTasks[0].scheduleStart;
  let latest = anchorTasks[0].scheduleEnd;
  for (const task of anchorTasks) {
    if (task.scheduleStart < earliest) earliest = task.scheduleStart;
    if (task.scheduleEnd > latest) latest = task.scheduleEnd;
  }
  let boundsEarliest = earliest;
  let boundsLatest = latest;
  for (const task of extraBoundsTasks) {
    if (task.scheduleStart < boundsEarliest)
      boundsEarliest = task.scheduleStart;
    if (task.scheduleEnd > boundsLatest) boundsLatest = task.scheduleEnd;
  }
  // `fits`/`anchor`/`defaultStart` (which page opens with no explicit
  // request) are computed from `tasks` alone, same as before extraBoundsTasks
  // existed — an out-of-window external related task must never shift where
  // the chart first opens. Only the reachable minimumStart/maximumStart/
  // maximumEnd widen to include it, so paging, the date picker, and a "show
  // task dates" jump can still reach it.
  const ownMinimumStart = clampDate(
    subDays(startOfWeek(earliest, { weekStartsOn }), 7),
    minimumDate,
    maximumDate,
  );
  const ownMaximumEnd = clampDate(
    startOfDay(addDays(endOfWeek(latest, { weekStartsOn }), 28)),
    minimumDate,
    maximumDate,
  );
  const minimumStart = clampDate(
    subDays(startOfWeek(boundsEarliest, { weekStartsOn }), 7),
    minimumDate,
    maximumDate,
  );
  const maximumEnd = clampDate(
    startOfDay(addDays(endOfWeek(boundsLatest, { weekStartsOn }), 28)),
    minimumDate,
    maximumDate,
  );
  const maximumStart = new Date(
    Math.max(
      minimumStart.getTime(),
      subDays(maximumEnd, windowDays - 1).getTime(),
    ),
  );
  // `fits` (and anchor/defaultStart, which depend on it) is based on the own
  // bounds — not the extraBoundsTasks-widened minimumStart/maximumEnd above —
  // so an out-of-window external related task never shifts where the chart
  // first opens; it only widens what's reachable by paging or jumping. It's
  // compared against the current unit's window length, same as the rest of
  // this function's sizing.
  const fits =
    differenceInCalendarDays(ownMaximumEnd, ownMinimumStart) < windowDays;
  const anchor = today >= earliest && today <= latest ? today : earliest;
  const defaultStart = fits
    ? ownMinimumStart
    : subDays(startOfWeek(anchor, { weekStartsOn }), 7);
  const rangeStart = startOfDay(
    clampDate(
      requestedStart && !Number.isNaN(requestedStart.getTime())
        ? alignRangeStartToUnit(requestedStart, unit, weekStartsOn)
        : defaultStart,
      minimumStart,
      maximumStart,
    ),
  );
  const rangeEnd = clampDate(
    addDays(rangeStart, windowDays - 1),
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
    windowDays,
    hasPrevious: rangeStart > minimumStart,
    hasNext: rangeEnd < maximumEnd,
  };
}

// The width-dependent half of the timeline: cheap to recompute (a string
// template and a multiplication), unlike the day range above, so this is
// fine to re-derive on every zoom step.
export function buildGanttGridMetrics(
  dayCount: number,
  dayColumnWidthRem: number,
) {
  return {
    gridTemplateColumns: `repeat(${dayCount}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
    timelineMinWidthRem: dayCount * dayColumnWidthRem,
  };
}

export function buildGanttTimeline(
  tasks: { scheduleStart: Date; scheduleEnd: Date }[],
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  dayColumnWidthRem: number,
  requestedStart: Date | null = null,
  today: Date = new Date(),
  unit: GanttUnit = "day",
) {
  const range = buildGanttRange(
    tasks,
    weekStartsOn,
    requestedStart,
    today,
    unit,
  );
  if (!range) return null;
  return {
    ...range,
    ...buildGanttGridMetrics(range.days.length, dayColumnWidthRem),
  };
}

export type GanttHeaderColumn = {
  label: string;
  /** Inclusive index into the `days` array this column starts at. */
  startIndex: number;
  /** Inclusive index into the `days` array this column ends at. */
  endIndex: number;
};

function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

// Groups the visible per-day grid into one header column per unit — a
// week's worth of days under one "week start" label, a month's days under
// one "MMM yyyy" label, a quarter's months under one "Qn yyyy" label — while
// leaving the per-day grid itself untouched. Pure and independent of layout:
// callers turn {startIndex, endIndex} into a CSS Grid column span against
// the same 1-per-day grid getBarGridColumns positions bars on, which is what
// keeps a task's bar aligned under its grouped header column at every unit
// without the bar math needing to know about units at all.
export function buildGanttHeaderColumns(
  days: Date[],
  unit: GanttUnit,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
): GanttHeaderColumn[] {
  if (days.length === 0) return [];
  if (unit === "day") {
    return days.map((day, index) => ({
      label: format(day, "d"),
      startIndex: index,
      endIndex: index,
    }));
  }

  const keyOf = (day: Date): string => {
    switch (unit) {
      case "week":
        return startOfWeek(day, { weekStartsOn }).toISOString();
      case "month":
        return format(day, "yyyy-MM");
      case "quarter":
        return `${day.getFullYear()}-${quarterOf(day)}`;
    }
  };
  const labelOf = (day: Date): string => {
    switch (unit) {
      case "week":
        return format(startOfWeek(day, { weekStartsOn }), "MMM d");
      case "month":
        return format(day, "MMM yyyy");
      case "quarter":
        return `Q${quarterOf(day)} ${day.getFullYear()}`;
    }
  };

  const columns: GanttHeaderColumn[] = [];
  let currentKey: string | null = null;
  for (let index = 0; index < days.length; index++) {
    const day = days[index];
    const key = keyOf(day);
    if (key !== currentKey) {
      columns.push({
        label: labelOf(day),
        startIndex: index,
        endIndex: index,
      });
      currentKey = key;
    } else {
      columns[columns.length - 1].endIndex = index;
    }
  }
  return columns;
}
