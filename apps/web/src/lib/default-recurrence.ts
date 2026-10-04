import type { TaskRecurrence } from "@/types/task/recurrence";

// Turning repeat on starts weekly, on the due date's weekday.
export function defaultRecurrence(dueDate: Date | undefined): TaskRecurrence {
  return {
    frequency: "weekly",
    interval: 1,
    weekdays: [(dueDate ?? new Date()).getDay()],
    // Keeps the next due date on the same local day across DST changes.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}
