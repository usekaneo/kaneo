import type { TFunction } from "i18next";
import type { TaskRecurrence } from "@/types/task/recurrence";

// 2026-10-04 is a Sunday, so adding a weekday number gives that weekday.
const SUNDAY = Date.UTC(2026, 9, 4);

export function formatWeekday(
  day: number,
  locale: string,
  width: "long" | "short" | "narrow" = "long",
) {
  return new Intl.DateTimeFormat(locale, {
    weekday: width,
    timeZone: "UTC",
  }).format(new Date(SUNDAY + day * 86_400_000));
}

function formatPattern(t: TFunction, frequency: TaskRecurrence["frequency"]) {
  switch (frequency) {
    case "daily":
      return t("tasks:popover.recurrence.pattern.daily");
    case "weekly":
      return t("tasks:popover.recurrence.pattern.weekly");
    case "monthly":
      return t("tasks:popover.recurrence.pattern.monthly");
    case "yearly":
      return t("tasks:popover.recurrence.pattern.yearly");
  }
}

// An interval of 1 uses the pattern name: in languages such as Russian the
// plural "one" form also covers 21, 31, and so on, so it must show the count.
function formatInterval(
  t: TFunction,
  { frequency, interval }: Pick<TaskRecurrence, "frequency" | "interval">,
) {
  if (interval === 1) return formatPattern(t, frequency);
  switch (frequency) {
    case "daily":
      return t("tasks:recurrence.daily", { count: interval });
    case "weekly":
      return t("tasks:recurrence.weekly", { count: interval });
    case "monthly":
      return t("tasks:recurrence.monthly", { count: interval });
    case "yearly":
      return t("tasks:recurrence.yearly", { count: interval });
  }
}

export function formatRecurrence(
  t: TFunction,
  recurrence: Pick<TaskRecurrence, "frequency" | "interval" | "weekdays">,
  locale: string,
) {
  const rule = formatInterval(t, recurrence);
  if (recurrence.frequency !== "weekly" || !recurrence.weekdays?.length)
    return rule;

  const days = [...recurrence.weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((day) => formatWeekday(day, locale));
  return t("tasks:recurrence.onDays", {
    rule,
    days: new Intl.ListFormat(locale, { type: "conjunction" }).format(days),
  });
}
