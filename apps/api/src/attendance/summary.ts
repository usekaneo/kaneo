import { and, eq, gte, lt, lte } from "drizzle-orm";
import {
  effectiveSchedule,
  type Schedule,
  scheduledMinutes,
  workedAndOvertime,
} from "../company/schedule";
import { getCompanySettings } from "../company/settings";
import {
  addDays,
  zonedDay,
  zonedDayRange,
  zonedInstant,
} from "../company/zoned-time";
import db from "../database";
import {
  activityDailyTable,
  attendanceSessionTable,
  employeeProfileTable,
  leaveRequestTable,
  workspaceUserTable,
} from "../database/schema";

export type AttendanceSession = {
  id: string;
  clockIn: Date;
  clockOut: Date | null;
  source: string;
  note: string | null;
};

/**
 * present / late: clocked in (late past the grace period). leave: approved
 * leave on a working day. off: not a working day. absent: a past working day
 * with nothing. pending: today, not clocked in yet. upcoming: future.
 * notJoined: before the person started, so never counted as absent.
 */
export type DayStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "off"
  | "pending"
  | "upcoming"
  | "notJoined";

/** Approved leave, as far as attendance cares. */
export type ApprovedLeave = {
  startDate: string;
  endDate: string;
  type: string;
};

export type AttendanceDay = {
  day: string;
  status: DayStatus;
  lateMinutes: number;
  leaveType: string | null;
  sessions: AttendanceSession[];
  firstIn: Date | null;
  lastOut: Date | null;
  open: boolean;
  scheduledMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  activeSeconds: number;
  idleSeconds: number;
};

function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

/**
 * Pure: turns sessions and activity totals into one row per calendar day.
 * A session belongs to the day it started in; an open session counts up to
 * `now`, at most 24 hours (a forgotten clock-out shouldn't read as weeks of
 * work), and not at all when `countOpen` is false, as in payroll.
 */
export function summarizeDays({
  days,
  sessions,
  activity,
  schedule,
  timeZone,
  now,
  countOpen = true,
  leaves = [],
  lateGraceMinutes = 0,
  startDay,
}: {
  days: string[];
  sessions: AttendanceSession[];
  activity: Map<string, { active: number; idle: number }>;
  schedule: Schedule;
  timeZone: string;
  now: Date;
  countOpen?: boolean;
  leaves?: ApprovedLeave[];
  lateGraceMinutes?: number;
  /** The person's first day; earlier days without sessions are notJoined. */
  startDay?: string | null;
}): AttendanceDay[] {
  const today = zonedDay(now, timeZone);
  return days.map((day) => {
    const own = sessions
      .filter((s) => zonedDay(s.clockIn, timeZone) === day)
      .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
    const present = own.reduce(
      (sum, s) =>
        sum + minutesBetween(s.clockIn, sessionEnd(s, now, countOpen)),
      0,
    );
    const { worked, overtime } = workedAndOvertime(schedule, day, present);
    const closed = own.filter((s) => s.clockOut);
    const totals = activity.get(day) ?? { active: 0, idle: 0 };
    const scheduled = scheduledMinutes(schedule, day);
    const leave = leaves.find((l) => l.startDate <= day && day <= l.endDate);
    const firstIn = own[0]?.clockIn ?? null;
    const lateMinutes =
      firstIn && scheduled > 0
        ? minutesBetween(
            zonedInstant(day, schedule.workStart, timeZone),
            firstIn,
          )
        : 0;
    const status: DayStatus =
      own.length > 0
        ? lateMinutes > lateGraceMinutes
          ? "late"
          : "present"
        : startDay && day < startDay
          ? "notJoined"
          : scheduled === 0
            ? "off"
            : leave
              ? "leave"
              : day > today
                ? "upcoming"
                : day === today
                  ? "pending"
                  : "absent";
    return {
      day,
      status,
      lateMinutes: status === "late" ? lateMinutes : 0,
      leaveType: leave && scheduled > 0 ? leave.type : null,
      sessions: own,
      firstIn,
      lastOut:
        closed.length > 0
          ? (closed[closed.length - 1]?.clockOut ?? null)
          : null,
      open: own.some((s) => !s.clockOut),
      scheduledMinutes: scheduled,
      workedMinutes: worked,
      overtimeMinutes: overtime,
      activeSeconds: totals.active,
      idleSeconds: totals.idle,
    };
  });
}

const MAX_OPEN_MS = 24 * 60 * 60_000;

function sessionEnd(s: AttendanceSession, now: Date, countOpen: boolean) {
  if (s.clockOut) return s.clockOut;
  if (!countOpen) return s.clockIn;
  return new Date(Math.min(now.getTime(), s.clockIn.getTime() + MAX_OPEN_MS));
}

const MAX_RANGE_DAYS = 366;

export function dayRange(from: string, to: string) {
  const days: string[] = [];
  // Callers validate the range; the cap keeps a bad caller from spinning.
  for (
    let day = from;
    day <= to && days.length < MAX_RANGE_DAYS;
    day = addDays(day, 1)
  )
    days.push(day);
  return days;
}

/** Days `from`..`to` (inclusive, local dates) for one person. */
export async function getAttendanceDays(
  workspaceId: string,
  userId: string,
  from: string,
  to: string,
  now = new Date(),
  { countOpen = true }: { countOpen?: boolean } = {},
) {
  const company = await getCompanySettings(workspaceId);
  const timeZone = company.timezone;
  const start = zonedDayRange(from, timeZone).start;
  const end = zonedDayRange(to, timeZone).end;

  const [sessions, profile, activityRows, leaves, member] = await Promise.all([
    db
      .select({
        id: attendanceSessionTable.id,
        clockIn: attendanceSessionTable.clockIn,
        clockOut: attendanceSessionTable.clockOut,
        source: attendanceSessionTable.source,
        note: attendanceSessionTable.note,
      })
      .from(attendanceSessionTable)
      .where(
        and(
          eq(attendanceSessionTable.workspaceId, workspaceId),
          eq(attendanceSessionTable.userId, userId),
          gte(attendanceSessionTable.clockIn, start),
          lt(attendanceSessionTable.clockIn, end),
        ),
      ),
    db
      .select()
      .from(employeeProfileTable)
      .where(
        and(
          eq(employeeProfileTable.workspaceId, workspaceId),
          eq(employeeProfileTable.userId, userId),
        ),
      )
      .then((rows) => rows[0] ?? null),
    db
      .select({
        day: activityDailyTable.day,
        active: activityDailyTable.activeSeconds,
        idle: activityDailyTable.idleSeconds,
      })
      .from(activityDailyTable)
      .where(
        and(
          eq(activityDailyTable.workspaceId, workspaceId),
          eq(activityDailyTable.userId, userId),
          gte(activityDailyTable.day, from),
          lt(activityDailyTable.day, addDays(to, 1)),
        ),
      ),
    approvedLeave(workspaceId, from, to, userId),
    db
      .select({ joinedAt: workspaceUserTable.joinedAt })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      )
      .then((rows) => rows[0] ?? null),
  ]);

  const activity = new Map<string, { active: number; idle: number }>();
  for (const row of activityRows) {
    const totals = activity.get(row.day) ?? { active: 0, idle: 0 };
    totals.active += row.active;
    totals.idle += row.idle;
    activity.set(row.day, totals);
  }

  const days = summarizeDays({
    days: dayRange(from, to),
    sessions,
    activity,
    schedule: effectiveSchedule(company, profile),
    timeZone,
    now,
    countOpen,
    leaves,
    lateGraceMinutes: company.lateGraceMinutes,
    startDay: startDayOf(profile?.joinDate, member?.joinedAt, timeZone),
  });

  const count = (status: DayStatus) =>
    days.filter((d) => d.status === status).length;
  const sum = (
    key:
      | "scheduledMinutes"
      | "workedMinutes"
      | "overtimeMinutes"
      | "activeSeconds"
      | "idleSeconds",
  ) => days.reduce((total, d) => total + d[key], 0);
  const totals = {
    scheduledMinutes: sum("scheduledMinutes"),
    workedMinutes: sum("workedMinutes"),
    overtimeMinutes: sum("overtimeMinutes"),
    activeSeconds: sum("activeSeconds"),
    idleSeconds: sum("idleSeconds"),
    presentDays: count("present") + count("late"),
    lateDays: count("late"),
    absentDays: count("absent"),
    leaveDays: count("leave"),
  };

  return { timeZone, today: zonedDay(now, timeZone), days, totals };
}

/** Approved leave touching [from, to], for one person or everyone. */
export async function approvedLeave(
  workspaceId: string,
  from: string,
  to: string,
  userId?: string,
) {
  return db
    .select({
      userId: leaveRequestTable.userId,
      startDate: leaveRequestTable.startDate,
      endDate: leaveRequestTable.endDate,
      type: leaveRequestTable.type,
    })
    .from(leaveRequestTable)
    .where(
      and(
        eq(leaveRequestTable.workspaceId, workspaceId),
        userId ? eq(leaveRequestTable.userId, userId) : undefined,
        eq(leaveRequestTable.status, "approved"),
        lte(leaveRequestTable.startDate, to),
        gte(leaveRequestTable.endDate, from),
      ),
    );
}

/** HR's join date when set, otherwise the day they joined the workspace. */
export function startDayOf(
  joinDate: string | null | undefined,
  joinedAt: Date | null | undefined,
  timeZone: string,
) {
  return joinDate ?? (joinedAt ? zonedDay(joinedAt, timeZone) : null);
}
