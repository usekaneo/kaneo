import type { TaskRecurrence } from "@/types/task/recurrence";

// Turning repeat on starts weekly. Without weekdays the rule repeats on the due
// date's weekday, so it follows the due date until the user picks days.
export function defaultRecurrence(): TaskRecurrence {
  return {
    frequency: "weekly",
    interval: 1,
    // Keeps the next due date on the same local day across DST changes.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}
