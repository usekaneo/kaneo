const MINUTE_MS = 60 * 1000;

export const REMINDER_WINDOW_MINUTES = 10;

const DAY_MS = 24 * 60 * MINUTE_MS;

export function getDueDateDeadline(dueDate: Date) {
  return new Date(dueDate.getTime() + DAY_MS);
}

export function isDueDateOverdue({
  dueDate,
  now,
}: {
  dueDate: Date;
  now: Date;
}) {
  return now.getTime() >= getDueDateDeadline(dueDate).getTime();
}

export function isReminderDue({
  dueDate,
  leadTimeMinutes,
  now,
}: {
  dueDate: Date;
  leadTimeMinutes: number;
  now: Date;
}) {
  const targetTime =
    getDueDateDeadline(dueDate).getTime() - leadTimeMinutes * MINUTE_MS;
  const elapsedSinceTarget = now.getTime() - targetTime;

  return (
    elapsedSinceTarget >= 0 &&
    elapsedSinceTarget <= REMINDER_WINDOW_MINUTES * MINUTE_MS
  );
}
