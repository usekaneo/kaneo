import { addDays, format, isWeekend } from "date-fns";

export type HabitDay = {
  /** YYYY-MM-DD in the viewer's own calendar. */
  date: string;
  value: Date;
  isToday: boolean;
  isFuture: boolean;
  isWeekend: boolean;
};

export type HabitSpan = { before: number; after: number };

export const FULL_SPAN: HabitSpan = { before: 20, after: 3 };
// Phones fit five columns without sideways scrolling: the last four days and today.
export const COMPACT_SPAN: HabitSpan = { before: 4, after: 0 };

export const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");

// The grid's columns: `before` days, today, and `after` more.
export function habitDays(
  today: Date,
  { before, after }: HabitSpan = FULL_SPAN,
): HabitDay[] {
  return Array.from({ length: before + 1 + after }, (_, index) => {
    const offset = index - before;
    const value = addDays(today, offset);
    return {
      date: toDateKey(value),
      value,
      isToday: offset === 0,
      isFuture: offset > 0,
      isWeekend: isWeekend(value),
    };
  });
}

// Header groups: one per month the grid spans, with how many days it covers.
export function monthSpans(days: readonly HabitDay[]) {
  const spans: Array<{ month: Date; days: number }> = [];
  for (const day of days) {
    const last = spans.at(-1);
    if (last && last.month.getMonth() === day.value.getMonth()) last.days++;
    else spans.push({ month: day.value, days: 1 });
  }
  return spans;
}
