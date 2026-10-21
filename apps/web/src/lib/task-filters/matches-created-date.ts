import {
  type Day,
  endOfDay,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";

export function matchesCreatedDate(
  createdAt: string,
  preset: string,
  today: Date,
  weekStartsOn: Day,
) {
  let start: Date;
  switch (preset) {
    case "today":
      start = startOfDay(today);
      break;
    case "thisWeek":
      start = startOfWeek(today, { weekStartsOn });
      break;
    case "last7Days":
      start = startOfDay(subDays(today, 6));
      break;
    case "last30Days":
      start = startOfDay(subDays(today, 29));
      break;
    default:
      return false;
  }
  return isWithinInterval(new Date(createdAt), { start, end: endOfDay(today) });
}
