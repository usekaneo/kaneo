const MINUTE_MS = 60 * 1000;

// Events for one automation within this window share a single run.
export const AUTOMATION_BATCH_WINDOW_MS = 5 * MINUTE_MS;
// Events listed in a run's context; the rest are only counted.
export const AUTOMATION_BATCH_EVENT_LIMIT = 20;
// Pending events kept per automation; later matches are dropped until a run
// consumes the batch, so a bulk import cannot grow the table without bound.
export const AUTOMATION_PENDING_EVENT_LIMIT = 200;
export const AUTOMATION_DEFAULT_DAILY_RUNS = 24;
export const AUTOMATION_MAX_DAILY_RUNS = 100;
export const AUTOMATION_LIMIT_PER_OWNER = 50;
export const AUTOMATION_FAILURES_BEFORE_PAUSE = 3;
// Due dates that passed longer ago than this are not reported when an
// automation is created or re-enabled.
export const AUTOMATION_DUE_DATE_LOOKBACK_MS = 24 * 60 * MINUTE_MS;

export function isBatchReady(oldestEventAt: Date, now: Date) {
  return now.getTime() - oldestEventAt.getTime() >= AUTOMATION_BATCH_WINDOW_MS;
}

export function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Unset/empty means no cap. Invalid configuration blocks automation spending.
export function parseMonthlyBudget(value: string | undefined) {
  if (!value?.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
