import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  type Day,
  nextDay,
  startOfDay,
} from "date-fns";
import { getNextWeek, getThisWeekend } from "./quick-dates";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const ADD_UNIT = { d: addDays, w: addWeeks, m: addMonths } as const;

function matchPrefix(word: string, names: string[], minLength: number) {
  if (word.length < minLength) return -1;
  const matches = names.flatMap((name, index) =>
    name.startsWith(word) ? [index] : [],
  );
  return matches.length === 1 ? matches[0] : -1;
}

function dateFromParts(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

function parseMonthDay(
  monthName: string,
  day: string,
  year: string | undefined,
  today: Date,
) {
  const month = matchPrefix(monthName, MONTHS, 3);
  if (month < 0) return null;
  const date = dateFromParts(
    year ? Number(year) : today.getFullYear(),
    month,
    Number(day),
  );
  if (!date) return null;
  return !year && date < today ? addYears(date, 1) : date;
}

export function parseDateQuery(
  query: string,
  now: Date,
  weekStartsOn: Day,
): Date | null {
  const text = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;
  const today = startOfDay(now);

  if (["today", "tod", "now"].includes(text)) return today;
  if (["tomorrow", "tmr", "tmrw", "tom"].includes(text)) {
    return addDays(today, 1);
  }
  if (text === "next week") return getNextWeek(today, weekStartsOn);
  if (text === "next month") return addMonths(today, 1);
  if (text === "weekend" || text === "this weekend") {
    return getThisWeekend(today);
  }

  const relative = text.match(
    /^(?:in )?\+?(\d{1,3}) ?(d|days?|w|weeks?|m|months?)$/,
  );
  if (relative) {
    const unit = relative[2][0] as keyof typeof ADD_UNIT;
    return ADD_UNIT[unit](today, Number(relative[1]));
  }

  const weekday = text.match(/^(?:next |this |on )?([a-z]+)$/);
  if (weekday) {
    const index = matchPrefix(weekday[1], WEEKDAYS, 2);
    return index >= 0 ? nextDay(today, index as Day) : null;
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return dateFromParts(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const monthFirst = text.match(
    /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/,
  );
  if (monthFirst) {
    return parseMonthDay(monthFirst[1], monthFirst[2], monthFirst[3], today);
  }

  const dayFirst = text.match(
    /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?(?:,? (\d{4}))?$/,
  );
  if (dayFirst) {
    return parseMonthDay(dayFirst[2], dayFirst[1], dayFirst[3], today);
  }

  return null;
}
