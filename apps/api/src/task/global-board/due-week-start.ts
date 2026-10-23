const DAY_MS = 24 * 60 * 60 * 1000;

// Monday 00:00 UTC of the week containing `now`, for callers that send no
// week start of their own.
export function defaultDueWeekStart(now: Date) {
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

export function weekRange(weekStart: Date, weeksAhead: number) {
  const start = new Date(weekStart.getTime() + weeksAhead * 7 * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}
