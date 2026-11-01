// Sorts a lead's due date into the buckets a salesperson cares about.
export type FollowUpState = "overdue" | "today" | "upcoming" | "none";

export function followUpState(
  dueDate: string | null,
  now: Date = new Date(),
): FollowUpState {
  if (!dueDate) return "none";
  const due = new Date(dueDate);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  if (due < startOfToday) return "overdue";
  if (due < startOfTomorrow) return "today";
  return "upcoming";
}

// The date input yields YYYY-MM-DD; schedule it for 09:00 local time.
export function followUpIso(date: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const value = new Date(`${date}T09:00:00`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}
