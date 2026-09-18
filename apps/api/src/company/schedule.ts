import { isoWeekday } from "./zoned-time";

export type Schedule = {
  workDays: number[];
  workStart: string;
  workEnd: string;
  breakMinutes: number;
};

type ScheduleSource = {
  workDays: string | null;
  workStart: string | null;
  workEnd: string | null;
  breakMinutes: number | null;
};

export function parseWorkDays(value: string) {
  return value
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
}

function toMinutes(time: string) {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Company schedule, with any per-person overrides applied. */
export function effectiveSchedule(
  company: {
    workDays: string;
    workStart: string;
    workEnd: string;
    breakMinutes: number;
  },
  override?: ScheduleSource | null,
): Schedule {
  return {
    workDays: parseWorkDays(override?.workDays ?? company.workDays),
    workStart: override?.workStart ?? company.workStart,
    workEnd: override?.workEnd ?? company.workEnd,
    breakMinutes: override?.breakMinutes ?? company.breakMinutes,
  };
}

/** Minutes someone is expected to be at work on a day (0 on days off). */
export function scheduledMinutes(schedule: Schedule, day: string) {
  if (!schedule.workDays.includes(isoWeekday(day))) return 0;
  return Math.max(
    0,
    toMinutes(schedule.workEnd) - toMinutes(schedule.workStart),
  );
}

/** Paid minutes on a day: the scheduled span without the break. */
export function paidMinutes(schedule: Schedule, day: string) {
  const scheduled = scheduledMinutes(schedule, day);
  return scheduled === 0 ? 0 : Math.max(0, scheduled - schedule.breakMinutes);
}

/**
 * Worked is the time between clocking in and out; overtime is whatever runs
 * past the scheduled span (all of it on a day off). 10:02–19:18 against
 * 10:00–19:00 is 9h 16m worked, 16m overtime.
 */
export function workedAndOvertime(
  schedule: Schedule,
  day: string,
  presentMinutes: number,
) {
  return {
    worked: presentMinutes,
    overtime: Math.max(0, presentMinutes - scheduledMinutes(schedule, day)),
  };
}
