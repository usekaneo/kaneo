import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { TaskRecurrence } from "@/types/task/recurrence";

// Mirrors apps/api/src/task/recurrence/next-occurrence-date.ts so the date
// picker previews the dates the API will actually use.

const advance = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  yearly: addYears,
};

function nextWeekday(date: TZDate, interval: number, weekdays: number[]) {
  const fromMonday = (day: number) => (day + 6) % 7;
  const days = weekdays.map(fromMonday).sort((a, b) => a - b);
  const today = fromMonday(date.getDay());
  const later = days.find((day) => day > today);
  if (later !== undefined) return addDays(date, later - today);
  return addDays(addWeeks(date, interval), (days[0] ?? today) - today);
}

export function nextOccurrenceDate(date: Date, recurrence: TaskRecurrence) {
  const zoned = new TZDate(date.getTime(), recurrence.timeZone);
  const next =
    recurrence.frequency === "weekly" && recurrence.weekdays?.length
      ? nextWeekday(zoned, recurrence.interval, recurrence.weekdays)
      : advance[recurrence.frequency](zoned, recurrence.interval);
  return new Date(next.getTime());
}

export function upcomingOccurrences(
  dueDate: Date,
  recurrence: TaskRecurrence,
  count: number,
) {
  const dates: Date[] = [];
  let date = dueDate;
  for (let index = 0; index < count; index += 1) {
    date = nextOccurrenceDate(date, recurrence);
    dates.push(date);
  }
  return dates;
}
