import { calendarDay } from "../company/calendar-day";
import { z } from "../openapi";
import { timestamp } from "../time-entry/schema";

const MAX_DAYS = 62;

export const workspaceQuery = z.object({ workspaceId: z.string() });

export const clockBody = z.object({
  workspaceId: z.string(),
  note: z.string().max(500).optional(),
});

export const daysQuery = z
  .object({
    workspaceId: z.string(),
    userId: z.string().optional().openapi({
      description: "Defaults to you. Others need people:read_all.",
    }),
    from: calendarDay,
    to: calendarDay,
  })
  .refine((q) => q.to >= q.from, {
    message: "`to` must not be before `from`",
    path: ["to"],
  })
  .refine(
    (q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 < MAX_DAYS,
    { message: `At most ${MAX_DAYS} days at a time`, path: ["to"] },
  );

export const teamQuery = z.object({
  workspaceId: z.string(),
  day: calendarDay,
});

const MAX_SESSION_MS = 24 * 60 * 60_000;

function sessionLength(b: { clockIn: string; clockOut?: string | null }) {
  return Date.parse(b.clockOut ?? b.clockIn) - Date.parse(b.clockIn);
}

// A few minutes of slack for clock skew between the browser and the server.
function notInFuture(value: string | null | undefined) {
  return !value || Date.parse(value) <= Date.now() + 5 * 60_000;
}

export const sessionParam = z.object({ id: z.string() });

export const createSessionBody = z
  .object({
    workspaceId: z.string(),
    userId: z.string(),
    clockIn: timestamp,
    clockOut: timestamp.optional(),
    note: z.string().max(500).optional(),
  })
  .refine(
    (b) => !b.clockOut || Date.parse(b.clockOut) > Date.parse(b.clockIn),
    {
      message: "Clock-out must be after clock-in",
      path: ["clockOut"],
    },
  )
  .refine((b) => !b.clockOut || sessionLength(b) <= MAX_SESSION_MS, {
    message: "A session can be at most 24 hours",
    path: ["clockOut"],
  })
  .refine((b) => notInFuture(b.clockIn) && notInFuture(b.clockOut), {
    message: "Times can't be in the future",
    path: ["clockIn"],
  });

export const updateSessionBody = z
  .object({
    workspaceId: z.string(),
    clockIn: timestamp,
    clockOut: timestamp.nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine(
    (b) => !b.clockOut || Date.parse(b.clockOut) > Date.parse(b.clockIn),
    {
      message: "Clock-out must be after clock-in",
      path: ["clockOut"],
    },
  )
  .refine((b) => !b.clockOut || sessionLength(b) <= MAX_SESSION_MS, {
    message: "A session can be at most 24 hours",
    path: ["clockOut"],
  })
  .refine((b) => notInFuture(b.clockIn) && notInFuture(b.clockOut), {
    message: "Times can't be in the future",
    path: ["clockIn"],
  });
