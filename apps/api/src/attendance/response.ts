import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const attendanceSessionSchema = z
  .object({
    id: z.string(),
    clockIn: responseTimestamp,
    clockOut: nullableResponseTimestamp,
    source: z.string(),
    note: z.string().nullable(),
  })
  .openapi("AttendanceSession");

export const attendanceDaySchema = z
  .object({
    day: z.string(),
    status: z
      .enum([
        "present",
        "late",
        "absent",
        "leave",
        "off",
        "pending",
        "upcoming",
        "notJoined",
      ])
      .openapi({
        description:
          "late: clocked in after the start plus the grace period. leave: approved leave on a working day. pending: today, not clocked in yet.",
      }),
    lateMinutes: z.number(),
    leaveType: z.string().nullable(),
    sessions: z.array(attendanceSessionSchema),
    firstIn: nullableResponseTimestamp,
    lastOut: nullableResponseTimestamp,
    open: z.boolean(),
    scheduledMinutes: z.number(),
    workedMinutes: z.number().openapi({
      description: "Clocked-in time; an open session counts up to now.",
    }),
    overtimeMinutes: z.number(),
    activeSeconds: z.number().openapi({
      description: "Desktop activity with input. Separate from worked time.",
    }),
    idleSeconds: z.number(),
  })
  .openapi("AttendanceDay");

const totalsSchema = z.object({
  scheduledMinutes: z.number(),
  workedMinutes: z.number(),
  overtimeMinutes: z.number(),
  activeSeconds: z.number(),
  idleSeconds: z.number(),
  presentDays: z.number().openapi({ description: "Late days included." }),
  lateDays: z.number(),
  absentDays: z.number(),
  leaveDays: z.number(),
});

export const attendanceDaysSchema = z
  .object({
    timeZone: z.string(),
    today: z.string(),
    days: z.array(attendanceDaySchema),
    totals: totalsSchema,
  })
  .openapi("AttendanceDays");

export const attendanceStatusSchema = z
  .object({
    clockedIn: z.boolean(),
    since: nullableResponseTimestamp,
    today: attendanceDaySchema,
  })
  .openapi("AttendanceStatus");

export const teamAttendanceSchema = z
  .array(
    attendanceDaySchema.extend({
      userId: z.string(),
      name: z.string(),
      image: z.string().nullable(),
    }),
  )
  .openapi("TeamAttendance");
