import { and, eq, gt, gte, isNull, lt, ne, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { recordAudit } from "../audit/record-audit";
import { effectiveSchedule } from "../company/schedule";
import { getCompanySettings } from "../company/settings";
import { zonedDay, zonedDayRange } from "../company/zoned-time";
import db from "../database";
import {
  activityDailyTable,
  attendanceSessionTable,
  employeeProfileTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import {
  approvedLeave,
  getAttendanceDays,
  startDayOf,
  summarizeDays,
} from "./summary";

function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function openSession(workspaceId: string, userId: string) {
  const [open] = await db
    .select()
    .from(attendanceSessionTable)
    .where(
      and(
        eq(attendanceSessionTable.workspaceId, workspaceId),
        eq(attendanceSessionTable.userId, userId),
        isNull(attendanceSessionTable.clockOut),
      ),
    );
  return open ?? null;
}

export async function getStatus(
  workspaceId: string,
  userId: string,
  now = new Date(),
) {
  const company = await getCompanySettings(workspaceId);
  const today = zonedDay(now, company.timezone);
  const [open, days] = await Promise.all([
    openSession(workspaceId, userId),
    getAttendanceDays(workspaceId, userId, today, today, now),
  ]);
  const todayRow = days.days[0];
  if (!todayRow) {
    throw new HTTPException(500, { message: "Failed to read attendance" });
  }
  return {
    clockedIn: Boolean(open),
    since: open?.clockIn ?? null,
    today: todayRow,
  };
}

export async function clockIn(
  workspaceId: string,
  userId: string,
  note: string | undefined,
  source: "web" | "agent" = "web",
) {
  // Approved leave means the day is off; a mistaken tap shouldn't turn it
  // into a worked day. The approver can cancel the leave if plans change.
  const company = await getCompanySettings(workspaceId);
  const today = zonedDay(new Date(), company.timezone);
  const [onLeave] = await approvedLeave(workspaceId, today, today, userId);
  if (onLeave) {
    throw new HTTPException(409, {
      message: "You're on approved leave today",
    });
  }
  try {
    await db.insert(attendanceSessionTable).values({
      workspaceId,
      userId,
      clockIn: new Date(),
      source,
      note: note ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HTTPException(409, { message: "You are already clocked in" });
    }
    throw error;
  }
  return getStatus(workspaceId, userId);
}

export async function clockOut(workspaceId: string, userId: string) {
  const open = await openSession(workspaceId, userId);
  if (!open) {
    throw new HTTPException(409, { message: "You are not clocked in" });
  }
  const now = new Date();
  await db
    .update(attendanceSessionTable)
    .set({
      clockOut: now > open.clockIn ? now : open.clockIn,
      // Keeps the desktop app from clocking them straight back in today.
      clockOutSource: "web",
    })
    .where(eq(attendanceSessionTable.id, open.id));
  return getStatus(workspaceId, userId);
}

/** One day for everyone in the workspace, in three queries. */
export async function getTeamDay(
  workspaceId: string,
  day: string,
  now = new Date(),
) {
  const company = await getCompanySettings(workspaceId);
  const { start, end } = zonedDayRange(day, company.timezone);

  const [members, sessions, profiles, activity, leaves] = await Promise.all([
    db
      .select({
        userId: workspaceUserTable.userId,
        name: userTable.name,
        image: userTable.image,
        joinedAt: workspaceUserTable.joinedAt,
      })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(eq(workspaceUserTable.workspaceId, workspaceId))
      .orderBy(userTable.name),
    db
      .select()
      .from(attendanceSessionTable)
      .where(
        and(
          eq(attendanceSessionTable.workspaceId, workspaceId),
          gte(attendanceSessionTable.clockIn, start),
          lt(attendanceSessionTable.clockIn, end),
        ),
      ),
    db
      .select()
      .from(employeeProfileTable)
      .where(eq(employeeProfileTable.workspaceId, workspaceId)),
    db
      .select()
      .from(activityDailyTable)
      .where(
        and(
          eq(activityDailyTable.workspaceId, workspaceId),
          eq(activityDailyTable.day, day),
        ),
      ),
    approvedLeave(workspaceId, day, day),
  ]);

  return members.map((member) => {
    const totals = { active: 0, idle: 0 };
    for (const row of activity) {
      if (row.userId !== member.userId) continue;
      totals.active += row.activeSeconds;
      totals.idle += row.idleSeconds;
    }
    const profile = profiles.find((p) => p.userId === member.userId);
    const [summary] = summarizeDays({
      days: [day],
      sessions: sessions.filter((s) => s.userId === member.userId),
      activity: new Map([[day, totals]]),
      schedule: effectiveSchedule(company, profile),
      timeZone: company.timezone,
      now,
      leaves: leaves.filter((l) => l.userId === member.userId),
      lateGraceMinutes: company.lateGraceMinutes,
      startDay: startDayOf(
        profile?.joinDate,
        member.joinedAt,
        company.timezone,
      ),
    });
    const { joinedAt: _joinedAt, ...person } = member;
    return { ...person, ...(summary as NonNullable<typeof summary>) };
  });
}

async function assertMember(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    );
  if (!member) {
    throw new HTTPException(404, { message: "Person not found" });
  }
}

async function findSession(workspaceId: string, id: string) {
  const [session] = await db
    .select()
    .from(attendanceSessionTable)
    .where(
      and(
        eq(attendanceSessionTable.id, id),
        eq(attendanceSessionTable.workspaceId, workspaceId),
      ),
    );
  if (!session) {
    throw new HTTPException(404, { message: "Attendance session not found" });
  }
  return session;
}

const toSession = (s: typeof attendanceSessionTable.$inferSelect) => ({
  id: s.id,
  clockIn: s.clockIn,
  clockOut: s.clockOut,
  source: s.source,
  note: s.note,
});

// Sessions never overlap, so a day's worked time is never counted twice. An
// open session (no clock-out) runs until now.
async function assertNoOverlap(
  workspaceId: string,
  userId: string,
  clockIn: Date,
  clockOut: Date | null,
  exceptId?: string,
) {
  const [clash] = await db
    .select({ id: attendanceSessionTable.id })
    .from(attendanceSessionTable)
    .where(
      and(
        eq(attendanceSessionTable.workspaceId, workspaceId),
        eq(attendanceSessionTable.userId, userId),
        exceptId ? ne(attendanceSessionTable.id, exceptId) : undefined,
        clockOut ? lt(attendanceSessionTable.clockIn, clockOut) : undefined,
        or(
          isNull(attendanceSessionTable.clockOut),
          gt(attendanceSessionTable.clockOut, clockIn),
        ),
      ),
    )
    .limit(1);
  if (clash) {
    throw new HTTPException(409, {
      message: "This overlaps another session for this person",
    });
  }
}

// Corrections by someone with people:manage: forgotten clock-outs, missed
// days. Every change is audit logged with the before and after times.
export async function createSession(
  workspaceId: string,
  actorId: string,
  input: { userId: string; clockIn: Date; clockOut?: Date; note?: string },
) {
  await assertMember(workspaceId, input.userId);
  await assertNoOverlap(
    workspaceId,
    input.userId,
    input.clockIn,
    input.clockOut ?? null,
  );
  let created: typeof attendanceSessionTable.$inferSelect | undefined;
  try {
    [created] = await db
      .insert(attendanceSessionTable)
      .values({
        workspaceId,
        userId: input.userId,
        clockIn: input.clockIn,
        clockOut: input.clockOut ?? null,
        source: "manual",
        note: input.note ?? null,
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HTTPException(409, {
        message: "This person already has an open session",
      });
    }
    throw error;
  }
  if (!created) {
    throw new HTTPException(500, { message: "Failed to add the session" });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: "attendance.created",
    targetType: "user",
    targetId: input.userId,
    data: { clockIn: input.clockIn, clockOut: input.clockOut ?? null },
  });
  return toSession(created);
}

export async function updateSession(
  workspaceId: string,
  actorId: string,
  id: string,
  input: { clockIn: Date; clockOut?: Date | null; note?: string | null },
) {
  const before = await findSession(workspaceId, id);
  const clockOut =
    input.clockOut !== undefined ? input.clockOut : before.clockOut;
  if (clockOut && clockOut <= input.clockIn) {
    throw new HTTPException(400, {
      message: "Clock-out must be after clock-in",
    });
  }
  await assertNoOverlap(
    workspaceId,
    before.userId,
    input.clockIn,
    clockOut,
    id,
  );
  const [updated] = await db
    .update(attendanceSessionTable)
    .set({
      clockIn: input.clockIn,
      // A hand-edited end is a person's decision, not the app's.
      ...(input.clockOut !== undefined && {
        clockOut: input.clockOut,
        clockOutSource: input.clockOut ? "web" : null,
      }),
      ...(input.note !== undefined && { note: input.note }),
    })
    .where(eq(attendanceSessionTable.id, id))
    .returning()
    .catch((error) => {
      if (isUniqueViolation(error)) {
        throw new HTTPException(409, {
          message: "This person already has an open session",
        });
      }
      throw error;
    });
  if (!updated) {
    throw new HTTPException(404, { message: "Attendance session not found" });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: "attendance.updated",
    targetType: "user",
    targetId: before.userId,
    data: {
      from: { clockIn: before.clockIn, clockOut: before.clockOut },
      to: { clockIn: updated.clockIn, clockOut: updated.clockOut },
    },
  });
  return toSession(updated);
}

export async function deleteSession(
  workspaceId: string,
  actorId: string,
  id: string,
) {
  const before = await findSession(workspaceId, id);
  await db
    .delete(attendanceSessionTable)
    .where(eq(attendanceSessionTable.id, id));
  await recordAudit({
    workspaceId,
    actorId,
    action: "attendance.deleted",
    targetType: "user",
    targetId: before.userId,
    data: { clockIn: before.clockIn, clockOut: before.clockOut },
  });
  return toSession(before);
}

export { getAttendanceDays };
