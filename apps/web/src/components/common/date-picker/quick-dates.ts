import {
  addDays,
  addWeeks,
  type Day,
  isSameDay,
  isWeekend,
  nextSaturday,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type QuickDateId = "today" | "tomorrow" | "weekend" | "next-week";

export function getThisWeekend(today: Date) {
  return isWeekend(today) ? today : nextSaturday(today);
}

export function getNextWeek(today: Date, weekStartsOn: Day) {
  return startOfWeek(addWeeks(today, 1), { weekStartsOn });
}

export function getQuickDates(now: Date, weekStartsOn: Day) {
  const today = startOfDay(now);
  const dates: { id: QuickDateId; date: Date }[] = [
    { id: "today", date: today },
    { id: "tomorrow", date: addDays(today, 1) },
    { id: "weekend", date: getThisWeekend(today) },
    { id: "next-week", date: getNextWeek(today, weekStartsOn) },
  ];
  return dates.filter(
    (item, index) =>
      dates.findIndex((other) => isSameDay(other.date, item.date)) === index,
  );
}
