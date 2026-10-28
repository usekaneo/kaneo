import { Cron } from "croner";
import type { AutomationSchedule } from "./types";

const HOUR_MS = 60 * 60 * 1000;

function cronPattern(schedule: AutomationSchedule) {
  const [hour, minute] = schedule.time.split(":").map(Number);
  // croner counts weekdays from Sunday = 0.
  const days =
    schedule.frequency === "weekly"
      ? [...new Set(schedule.weekdays.map((day) => day % 7))]
          .sort((a, b) => a - b)
          .join(",")
      : "*";
  return `${minute} ${hour} * * ${days}`;
}

// The first slot strictly after `after`. Wall-clock times follow the
// schedule's time zone, so 09:00 stays 09:00 across DST changes. A time that
// does not exist on a spring-forward day runs when the clocks jump (02:30 →
// 03:00); a time that repeats on a fall-back day runs once.
export function nextScheduledRun(schedule: AutomationSchedule, after: Date) {
  if (schedule.frequency === "interval")
    return new Date(after.getTime() + (schedule.intervalHours ?? 24) * HOUR_MS);
  const job = new Cron(cronPattern(schedule), {
    timezone: schedule.timezone,
    paused: true,
  });
  try {
    return job.nextRun(after);
  } finally {
    job.stop();
  }
}

// After running the slot at `slot`, the next slot. Missed slots (for example
// while the server was down) are not replayed: the result is always in the
// future relative to `now`.
export function followingRun(
  schedule: AutomationSchedule,
  slot: Date,
  now: Date,
) {
  const next = nextScheduledRun(schedule, slot);
  if (next && next > now) return next;
  return nextScheduledRun(schedule, now);
}
