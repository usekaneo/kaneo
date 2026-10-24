import { addDays, format, isWeekend } from "date-fns";

export type HabitDay = {
  /** YYYY-MM-DD in the viewer's own calendar. */
  date: string;
  value: Date;
  isToday: boolean;
  isFuture: boolean;
  isWeekend: boolean;
};

export const DAYS_BEFORE = 20;
export const DAYS_AFTER = 3;

export const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");

// The grid's columns: the last DAYS_BEFORE days, today, and DAYS_AFTER more.
export function habitDays(today: Date): HabitDay[] {
  return Array.from({ length: DAYS_BEFORE + 1 + DAYS_AFTER }, (_, index) => {
    const offset = index - DAYS_BEFORE;
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
