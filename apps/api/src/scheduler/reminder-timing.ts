const MINUTE_MS = 60 * 1000;
// Stored due dates lack IANA timezone information, so 24 hours approximates a
// calendar day; DST days can last 23 or 25 hours. Track exact semantics in #1783.
export const DUE_DATE_DURATION_MS = 24 * 60 * MINUTE_MS;

export const REMINDER_WINDOW_MINUTES = 10;

export function isReminderDue({
  dueDate,
  leadTimeMinutes,
  now,
}: {
  dueDate: Date;
  leadTimeMinutes: number;
  now: Date;
}) {
  // Due dates represent a full day; reminders count back from its expiration.
  const targetTime =
    dueDate.getTime() + DUE_DATE_DURATION_MS - leadTimeMinutes * MINUTE_MS;
  const elapsedSinceTarget = now.getTime() - targetTime;

  return (
    elapsedSinceTarget >= 0 &&
    elapsedSinceTarget <= REMINDER_WINDOW_MINUTES * MINUTE_MS
  );
}
