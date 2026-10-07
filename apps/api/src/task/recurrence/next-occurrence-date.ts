import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
} from "date-fns";
import type { TaskRecurrence } from "./schema";

const advance = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  yearly: addYears,
};

// Weeks start on Monday. The next selected day later in the same week wins;
// otherwise the first selected day `interval` weeks later.
function nextWeekday(date: TZDate, interval: number, weekdays: number[]) {
  const fromMonday = (day: number) => (day + 6) % 7;
  const days = weekdays.map(fromMonday).sort((a, b) => a - b);
  const today = fromMonday(date.getDay());
  const later = days.find((day) => day > today);
  if (later !== undefined) return addDays(date, later - today);
  return addDays(addWeeks(date, interval), (days[0] ?? today) - today);
}

// Dates are moved in the rule's time zone so a local-midnight due date stays on
// its local day across daylight saving changes. Month ends clamp (Jan 31 ->
// Feb 28), and the next step starts from the clamped date.
export function nextOccurrenceDate(date: Date, recurrence: TaskRecurrence) {
  const zoned = new TZDate(date.getTime(), recurrence.timeZone);
  const next =
    recurrence.frequency === "weekly" && recurrence.weekdays?.length
      ? nextWeekday(zoned, recurrence.interval, recurrence.weekdays)
      : advance[recurrence.frequency](zoned, recurrence.interval);
  return new Date(next.getTime());
}

// The next task is due one step after the completed task's due date, or after
// its completion when it had none. A start date moves by the same number of
// days, so the task keeps its length.
export function nextOccurrenceDates(
  task: { startDate: Date | null; dueDate: Date | null },
  recurrence: TaskRecurrence,
  completedAt: Date,
) {
  const dueDate = nextOccurrenceDate(task.dueDate ?? completedAt, recurrence);
  if (!task.startDate || !task.dueDate) return { startDate: null, dueDate };

  const zone = (date: Date) => new TZDate(date.getTime(), recurrence.timeZone);
  const shift = differenceInCalendarDays(zone(dueDate), zone(task.dueDate));
  const startDate = addDays(zone(task.startDate), shift);
  return { startDate: new Date(startDate.getTime()), dueDate };
}
