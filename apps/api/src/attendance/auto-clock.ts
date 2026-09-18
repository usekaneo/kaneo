import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { getCompanySettings } from "../company/settings";
import { zonedDay } from "../company/zoned-time";
import db from "../database";
import {
  agentDeviceTable,
  attendanceSessionTable,
  companySettingsTable,
} from "../database/schema";
import { approvedLeave } from "./summary";

/*
 * Auto clock in/out from the desktop app.
 *
 * - The app's heartbeats and uploads keep `agent_device.last_active_at` at the
 *   latest keyboard/mouse activity. Activity while clocked out clocks the
 *   person in (source "agent"), unless they're on leave or clocked themselves
 *   out earlier that day: a person's own clock-out always wins.
 * - A job every minute clocks out agent sessions once the person has been idle
 *   for `autoClockIdleMinutes`, or none of their devices has been heard from
 *   for `autoClockOfflineMinutes`. The clock-out is set back to the last
 *   activity, so the delay never adds time.
 * - Coming back within the offline window after an automatic clock-out
 *   continues that session instead of starting a new one, so a flaky
 *   connection doesn't split the day into fragments.
 */

type Device = typeof agentDeviceTable.$inferSelect;

function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Called after a device reports keyboard/mouse activity between `from` and `to`. */
export async function autoClockIn(
  device: Pick<Device, "workspaceId" | "userId">,
  activity: { from: Date; to: Date },
  now = new Date(),
) {
  const company = await getCompanySettings(device.workspaceId);
  if (!company.autoClock) return;
  const idleMs = company.autoClockIdleMinutes * 60_000;
  // An old offline queue says nothing about whether anyone is working now.
  if (now.getTime() - activity.to.getTime() > idleMs) return;
  // Count from when this stretch of activity began, at most one idle window back.
  const activeFrom = new Date(
    Math.max(activity.from.getTime(), now.getTime() - idleMs),
  );

  const [latest] = await db
    .select()
    .from(attendanceSessionTable)
    .where(
      and(
        eq(attendanceSessionTable.workspaceId, device.workspaceId),
        eq(attendanceSessionTable.userId, device.userId),
      ),
    )
    .orderBy(desc(attendanceSessionTable.clockIn))
    .limit(1);

  if (latest && !latest.clockOut) return;

  const today = zonedDay(now, company.timezone);
  if (latest?.clockOut) {
    const closedToday = zonedDay(latest.clockOut, company.timezone) === today;
    if (closedToday && latest.clockOutSource !== "agent") return;

    const offlineMs = company.autoClockOfflineMinutes * 60_000;
    if (
      latest.clockOutSource === "agent" &&
      now.getTime() - latest.clockOut.getTime() <= offlineMs
    ) {
      await db
        .update(attendanceSessionTable)
        .set({ clockOut: null, clockOutSource: null })
        .where(eq(attendanceSessionTable.id, latest.id))
        .catch((error) => {
          // Someone clocked in by hand in the meantime.
          if (!isUniqueViolation(error)) throw error;
        });
      return;
    }
  }

  const [onLeave] = await approvedLeave(
    device.workspaceId,
    today,
    today,
    device.userId,
  );
  if (onLeave) return;

  try {
    await db.insert(attendanceSessionTable).values({
      workspaceId: device.workspaceId,
      userId: device.userId,
      // Never before the end of the previous session.
      clockIn:
        latest?.clockOut && latest.clockOut > activeFrom
          ? latest.clockOut
          : activeFrom,
      source: "agent",
    });
  } catch (error) {
    // Clocked in by another device or by hand a moment ago.
    if (!isUniqueViolation(error)) throw error;
  }
}

/** What the desktop app shows: whether its person is clocked in, and how. */
export async function attendanceStatus(
  device: Pick<Device, "workspaceId" | "userId">,
) {
  const [company, [open]] = await Promise.all([
    getCompanySettings(device.workspaceId),
    db
      .select({
        clockIn: attendanceSessionTable.clockIn,
        source: attendanceSessionTable.source,
      })
      .from(attendanceSessionTable)
      .where(
        and(
          eq(attendanceSessionTable.workspaceId, device.workspaceId),
          eq(attendanceSessionTable.userId, device.userId),
          isNull(attendanceSessionTable.clockOut),
        ),
      ),
  ]);
  return {
    autoClock: company.autoClock,
    clockedIn: Boolean(open),
    since: open?.clockIn ?? null,
    automatic: open?.source === "agent",
  };
}

/**
 * Clocks out agent sessions whose person went idle or offline. Pass `userId`
 * to check just one person right away (the app is quitting).
 */
export async function autoClockOut(
  now = new Date(),
  only?: { workspaceId: string; userId: string },
) {
  const open = await db
    .select({
      id: attendanceSessionTable.id,
      workspaceId: attendanceSessionTable.workspaceId,
      userId: attendanceSessionTable.userId,
      clockIn: attendanceSessionTable.clockIn,
      idleMinutes: companySettingsTable.autoClockIdleMinutes,
      offlineMinutes: companySettingsTable.autoClockOfflineMinutes,
    })
    .from(attendanceSessionTable)
    .leftJoin(
      companySettingsTable,
      eq(companySettingsTable.workspaceId, attendanceSessionTable.workspaceId),
    )
    .where(
      and(
        isNull(attendanceSessionTable.clockOut),
        eq(attendanceSessionTable.source, "agent"),
        only
          ? and(
              eq(attendanceSessionTable.workspaceId, only.workspaceId),
              eq(attendanceSessionTable.userId, only.userId),
            )
          : undefined,
      ),
    );
  if (open.length === 0) return { closed: 0 };

  const devices = await db
    .select({
      workspaceId: agentDeviceTable.workspaceId,
      userId: agentDeviceTable.userId,
      lastSeenAt: max(agentDeviceTable.lastSeenAt),
      lastActiveAt: max(agentDeviceTable.lastActiveAt),
    })
    .from(agentDeviceTable)
    .where(
      and(
        isNull(agentDeviceTable.revokedAt),
        inArray(agentDeviceTable.userId, [
          ...new Set(open.map((s) => s.userId)),
        ]),
      ),
    )
    .groupBy(agentDeviceTable.workspaceId, agentDeviceTable.userId);
  // A device that said goodbye counts as gone straight away.
  const quit = only
    ? await db
        .select({
          id: agentDeviceTable.id,
          lastState: agentDeviceTable.lastState,
        })
        .from(agentDeviceTable)
        .where(
          and(
            eq(agentDeviceTable.workspaceId, only.workspaceId),
            eq(agentDeviceTable.userId, only.userId),
            isNull(agentDeviceTable.revokedAt),
          ),
        )
    : [];
  const allQuit =
    quit.length > 0 && quit.every((d) => d.lastState === "offline");

  let closed = 0;
  for (const session of open) {
    const seen = devices.find(
      (d) =>
        d.workspaceId === session.workspaceId && d.userId === session.userId,
    );
    const idleMs = (session.idleMinutes ?? 15) * 60_000;
    const offlineMs = (session.offlineMinutes ?? 10) * 60_000;
    const lastActive = seen?.lastActiveAt ?? null;
    const lastSeen = seen?.lastSeenAt ?? null;
    const gone =
      allQuit ||
      !lastSeen ||
      now.getTime() - lastSeen.getTime() > offlineMs ||
      !lastActive ||
      now.getTime() - lastActive.getTime() > idleMs;
    if (!gone) continue;

    let clockOut = lastActive && lastActive < now ? lastActive : now;
    if (clockOut < session.clockIn) clockOut = session.clockIn;
    const updated = await db
      .update(attendanceSessionTable)
      .set({ clockOut, clockOutSource: "agent" })
      .where(
        and(
          eq(attendanceSessionTable.id, session.id),
          isNull(attendanceSessionTable.clockOut),
        ),
      )
      .returning({ id: attendanceSessionTable.id });
    closed += updated.length;
  }
  return { closed };
}
