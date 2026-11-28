import { format, isValid, parseISO } from "date-fns";

export type DateCondition = {
  operator: "exact" | "range" | "before" | "after";
  date: string;
  end?: string;
};

export function parseDateCondition(value: string): DateCondition | null {
  const parts = value.split(":");
  const [operator, date, end] = parts;
  if (
    !["exact", "range", "before", "after"].includes(operator) ||
    parts.length > 3
  )
    return null;
  const validDay = (day: string | undefined): day is string =>
    !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && isValid(parseISO(day));
  if (!validDay(date)) return null;
  if (operator === "range" ? !validDay(end) || end < date : end !== undefined)
    return null;
  return { operator: operator as DateCondition["operator"], date, end };
}

export function serializeDateCondition(condition: DateCondition): string {
  return `${condition.operator}:${condition.date}${condition.operator === "range" ? `:${condition.end}` : ""}`;
}

export function matchesDateCondition(
  value: string | Date,
  condition: DateCondition,
) {
  // Date-only values stay calendar days; timestamps follow the user's local calendar.
  const parsed = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(parsed)) return false;
  const day = format(parsed, "yyyy-MM-dd");
  switch (condition.operator) {
    case "exact":
      return day === condition.date;
    case "range":
      return day >= condition.date && day <= condition.end!;
    case "before":
      return day < condition.date;
    case "after":
      return day > condition.date;
  }
}
