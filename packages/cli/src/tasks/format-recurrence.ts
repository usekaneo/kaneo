import type { TaskRecurrence } from "../api/schemas.js";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const UNITS = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
} as const;

const fromMonday = (day: number) => (day + 6) % 7;

function joinDays(days: ReadonlyArray<string>): string {
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} and ${days.at(-1)}`;
}

// "Weekly", "Every 2 weeks on Monday and Thursday": weeks start on Monday,
// as they do when the API picks the next selected day.
export function formatRecurrence(
  recurrence: Pick<TaskRecurrence, "frequency" | "interval" | "weekdays">,
): string {
  const { frequency, interval } = recurrence;
  const rule =
    interval === 1
      ? frequency.charAt(0).toUpperCase() + frequency.slice(1)
      : `Every ${interval} ${UNITS[frequency]}s`;
  const weekdays = recurrence.weekdays ?? [];
  if (frequency !== "weekly" || weekdays.length === 0) return rule;
  const days = [...weekdays]
    .sort((a, b) => fromMonday(a) - fromMonday(b))
    .map((day) => DAY_NAMES[day] ?? String(day));
  return `${rule} on ${joinDays(days)}`;
}
