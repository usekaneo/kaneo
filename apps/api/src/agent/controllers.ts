import { and, desc, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  attendanceStatus,
  autoClockIn,
  autoClockOut,
} from "../attendance/auto-clock";
import { recordAudit } from "../audit/record-audit";
import { ONLINE_WINDOW_MS } from "../company/presence";
import { getCompanySettings } from "../company/settings";
import { addDays, zonedDay, zonedDayRange } from "../company/zoned-time";
import db from "../database";
import {
  activityDailyTable,
  activitySpanTable,
  agentDeviceTable,
  agentPairingCodeTable,
  companySettingsTable,
  userTable,
  workspaceTable,
} from "../database/schema";
import {
  type AuthenticatedDevice,
  hashSecret,
  newDeviceToken,
  newPairingCode,
  normalizePairingCode,
} from "./device-auth";

const PAIRING_TTL_MS = 10 * 60 * 1000;

async function agentSettings(workspaceId: string) {
  const company = await getCompanySettings(workspaceId);
  return {
    trackDomains: company.trackDomains,
    heartbeatSeconds: 60,
    syncSeconds: 60,
    idleAfterSeconds: 300,
  };
}

// ---------------------------------------------------------------- pairing

export async function createPairingCode(workspaceId: string, userId: string) {
  const code = newPairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  // One live code per person: a new one replaces any unused earlier code.
  await db
    .delete(agentPairingCodeTable)
    .where(
      and(
        eq(agentPairingCodeTable.userId, userId),
        eq(agentPairingCodeTable.workspaceId, workspaceId),
        isNull(agentPairingCodeTable.usedAt),
      ),
    );
  await db.insert(agentPairingCodeTable).values({
    workspaceId,
    userId,
    codeHash: hashSecret(code),
    expiresAt,
  });
  return { code, expiresAt };
}

export async function pairDevice(input: {
  code: string;
  deviceName: string;
  platform: string;
  agentVersion?: string;
}) {
  const normalized = normalizePairingCode(input.code);
  if (!normalized) {
    throw new HTTPException(400, { message: "That code is not valid" });
  }

  // Claim the code atomically so it can be used exactly once.
  const [claimed] = await db
    .update(agentPairingCodeTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(agentPairingCodeTable.codeHash, hashSecret(normalized)),
        isNull(agentPairingCodeTable.usedAt),
        gt(agentPairingCodeTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!claimed) {
    throw new HTTPException(400, {
      message: "That code is not valid or has expired",
    });
  }

  const token = newDeviceToken();
  const [device] = await db
    .insert(agentDeviceTable)
    .values({
      workspaceId: claimed.workspaceId,
      userId: claimed.userId,
      name: input.deviceName,
      platform: input.platform,
      agentVersion: input.agentVersion ?? null,
      tokenHash: hashSecret(token),
      lastSeenAt: new Date(),
    })
    .returning();
  if (!device) {
    throw new HTTPException(500, { message: "Failed to pair the device" });
  }

  const [context] = await db
    .select({ workspaceName: workspaceTable.name, userName: userTable.name })
    .from(workspaceTable)
    .innerJoin(userTable, eq(userTable.id, claimed.userId))
    .where(eq(workspaceTable.id, claimed.workspaceId));

  return {
    deviceId: device.id,
    token,
    workspaceId: claimed.workspaceId,
    workspaceName: context?.workspaceName ?? "",
    userName: context?.userName ?? "",
    settings: await agentSettings(claimed.workspaceId),
  };
}

// ----------------------------------------------------------- device calls

/**
 * Records that the device is alive. `activity` is when it last saw someone at
 * the keyboard: a heartbeat reports the present, an upload reports when its
 * active spans ran (which can be long ago for an offline queue).
 */
export async function heartbeat(
  device: AuthenticatedDevice,
  state: string,
  agentVersion?: string,
  activity?: { from: Date; to: Date } | null,
) {
  const now = new Date();
  const active =
    activity !== undefined
      ? activity
      : state === "active"
        ? { from: now, to: now }
        : null;
  const lastActiveAt =
    active && (!device.lastActiveAt || active.to > device.lastActiveAt)
      ? active.to
      : undefined;
  await db
    .update(agentDeviceTable)
    .set({
      lastSeenAt: now,
      lastState: state,
      ...(agentVersion && { agentVersion }),
      ...(lastActiveAt && { lastActiveAt }),
    })
    .where(eq(agentDeviceTable.id, device.id));
  if (active) await autoClockIn(device, active, now);
  return {
    settings: await agentSettings(device.workspaceId),
    serverTime: now,
    attendance: await attendanceStatus(device),
  };
}

/** The app quit: clock its person out now unless another device is still on. */
export async function goOffline(device: AuthenticatedDevice) {
  await db
    .update(agentDeviceTable)
    .set({ lastSeenAt: new Date(), lastState: "offline" })
    .where(eq(agentDeviceTable.id, device.id));
  await autoClockOut(new Date(), {
    workspaceId: device.workspaceId,
    userId: device.userId,
  });
  return { attendance: await attendanceStatus(device) };
}

type IncomingSpan = {
  id: string;
  start: string;
  end: string;
  state: "active" | "idle";
  app?: string;
  domain?: string;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A device's time can only be counted once: spans that overlap one already
// stored (or an earlier one in the same upload) are dropped. A retried span
// with the same client id passes through and is ignored on insert instead.
async function dropOverlaps(tx: Tx, deviceId: string, spans: IncomingSpan[]) {
  const sorted = [...spans].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const first = Date.parse(sorted[0]?.start ?? "");
  const last = Math.max(...sorted.map((s) => Date.parse(s.end)));
  const stored = await tx
    .select({
      clientId: activitySpanTable.clientId,
      startedAt: activitySpanTable.startedAt,
      endedAt: activitySpanTable.endedAt,
    })
    .from(activitySpanTable)
    .where(
      and(
        eq(activitySpanTable.deviceId, deviceId),
        lt(activitySpanTable.startedAt, new Date(last)),
        gt(activitySpanTable.endedAt, new Date(first)),
      ),
    );
  const storedIds = new Set(stored.map((s) => s.clientId));
  const taken = stored.map((s) => ({
    start: s.startedAt.getTime(),
    end: s.endedAt.getTime(),
  }));
  const kept: IncomingSpan[] = [];
  for (const span of sorted) {
    if (storedIds.has(span.id)) {
      kept.push(span);
      continue;
    }
    const start = Date.parse(span.start);
    const end = Date.parse(span.end);
    if (taken.some((t) => t.start < end && t.end > start)) continue;
    taken.push({ start, end });
    kept.push(span);
  }
  return kept;
}

export async function ingestActivity(
  device: AuthenticatedDevice,
  spans: IncomingSpan[],
) {
  const company = await getCompanySettings(device.workspaceId);
  const now = Date.now();
  const oldest = now - company.activityDetailDays * 86_400_000;

  // Clock skew and very old offline queues are dropped rather than stored.
  const usable = spans.filter((s) => {
    const start = Date.parse(s.start);
    const end = Date.parse(s.end);
    return end <= now + 5 * 60_000 && start >= oldest;
  });

  if (usable.length === 0) {
    // Nothing current in the batch says anyone is at the keyboard now.
    await heartbeat(device, "active", undefined, null);
    return { accepted: 0, duplicates: spans.length };
  }

  // One device's uploads run one at a time, and the spans and the daily
  // totals they add are written together or not at all.
  const inserted = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`agent-ingest:${device.id}`}))`,
    );
    const fresh = await dropOverlaps(tx, device.id, usable);
    if (fresh.length === 0) return [];
    const inserted = await tx
      .insert(activitySpanTable)
      .values(
        fresh.map((s) => ({
          deviceId: device.id,
          clientId: s.id,
          workspaceId: device.workspaceId,
          userId: device.userId,
          startedAt: new Date(s.start),
          endedAt: new Date(s.end),
          state: s.state,
          app: s.app || null,
          domain: company.trackDomains ? s.domain || null : null,
        })),
      )
      .onConflictDoNothing({
        target: [activitySpanTable.deviceId, activitySpanTable.clientId],
      })
      .returning();

    // Daily totals only for spans stored just now, so retries never double count.
    const totals = new Map<
      string,
      { day: string; app: string; domain: string; active: number; idle: number }
    >();
    for (const span of inserted) {
      const day = zonedDay(span.startedAt, company.timezone);
      const app = span.app ?? "";
      const domain = span.domain ?? "";
      const key = JSON.stringify([day, app, domain]);
      const seconds = Math.round(
        (span.endedAt.getTime() - span.startedAt.getTime()) / 1000,
      );
      const row = totals.get(key) ?? { day, app, domain, active: 0, idle: 0 };
      if (span.state === "active") row.active += seconds;
      else row.idle += seconds;
      totals.set(key, row);
    }

    if (totals.size > 0) {
      await tx
        .insert(activityDailyTable)
        .values(
          [...totals.values()].map((t) => ({
            workspaceId: device.workspaceId,
            userId: device.userId,
            day: t.day,
            app: t.app,
            domain: t.domain,
            activeSeconds: t.active,
            idleSeconds: t.idle,
          })),
        )
        .onConflictDoUpdate({
          target: [
            activityDailyTable.workspaceId,
            activityDailyTable.userId,
            activityDailyTable.day,
            activityDailyTable.app,
            activityDailyTable.domain,
          ],
          set: {
            activeSeconds: sql`${activityDailyTable.activeSeconds} + excluded.active_seconds`,
            idleSeconds: sql`${activityDailyTable.idleSeconds} + excluded.idle_seconds`,
          },
        });
    }

    return inserted;
  });

  const latest = inserted.reduce<(typeof inserted)[number] | null>(
    (last, span) => (!last || span.endedAt > last.endedAt ? span : last),
    null,
  );
  const activeSpans = usable.filter((s) => s.state === "active");
  const activity =
    activeSpans.length > 0
      ? {
          from: new Date(
            Math.min(...activeSpans.map((s) => Date.parse(s.start))),
          ),
          to: new Date(
            Math.min(
              now,
              Math.max(...activeSpans.map((s) => Date.parse(s.end))),
            ),
          ),
        }
      : null;
  await heartbeat(device, latest?.state ?? "active", undefined, activity);

  return {
    accepted: inserted.length,
    duplicates: spans.length - inserted.length,
  };
}

// ------------------------------------------------------ devices (session)

function presentDevice(d: typeof agentDeviceTable.$inferSelect, now: number) {
  return {
    id: d.id,
    userId: d.userId,
    name: d.name,
    platform: d.platform,
    agentVersion: d.agentVersion,
    lastSeenAt: d.lastSeenAt,
    lastState: d.lastState,
    online:
      !d.revokedAt &&
      Boolean(d.lastSeenAt && now - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS),
    revokedAt: d.revokedAt,
    createdAt: d.createdAt,
  };
}

export async function listDevices(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(agentDeviceTable)
    .where(
      and(
        eq(agentDeviceTable.workspaceId, workspaceId),
        eq(agentDeviceTable.userId, userId),
      ),
    )
    .orderBy(desc(agentDeviceTable.createdAt));
  const now = Date.now();
  return rows.map((d) => presentDevice(d, now));
}

export async function findDevice(workspaceId: string, id: string) {
  const [device] = await db
    .select()
    .from(agentDeviceTable)
    .where(
      and(
        eq(agentDeviceTable.id, id),
        eq(agentDeviceTable.workspaceId, workspaceId),
      ),
    );
  if (!device) {
    throw new HTTPException(404, { message: "Device not found" });
  }
  return device;
}

export async function revokeDevice(
  workspaceId: string,
  actorId: string,
  id: string,
) {
  const device = await findDevice(workspaceId, id);
  const [revoked] = await db
    .update(agentDeviceTable)
    .set({ revokedAt: device.revokedAt ?? new Date() })
    .where(eq(agentDeviceTable.id, id))
    .returning();
  if (!device.revokedAt) {
    await recordAudit({
      workspaceId,
      actorId,
      action: "device.revoked",
      targetType: "user",
      targetId: device.userId,
      data: { deviceId: device.id, name: device.name },
    });
  }
  return presentDevice(revoked ?? device, Date.now());
}

// ------------------------------------------------------ activity (session)

export async function activitySummary(
  workspaceId: string,
  userId: string,
  from: string,
  to: string,
) {
  const company = await getCompanySettings(workspaceId);
  const rows = await db
    .select({
      day: activityDailyTable.day,
      app: activityDailyTable.app,
      domain: activityDailyTable.domain,
      active: activityDailyTable.activeSeconds,
      idle: activityDailyTable.idleSeconds,
    })
    .from(activityDailyTable)
    .where(
      and(
        eq(activityDailyTable.workspaceId, workspaceId),
        eq(activityDailyTable.userId, userId),
        gte(activityDailyTable.day, from),
        lte(activityDailyTable.day, to),
      ),
    );

  const apps = new Map<string, number>();
  const domains = new Map<string, number>();
  const days = new Map<string, { active: number; idle: number }>();
  let activeSeconds = 0;
  let idleSeconds = 0;

  for (const row of rows) {
    activeSeconds += row.active;
    idleSeconds += row.idle;
    const day = days.get(row.day) ?? { active: 0, idle: 0 };
    day.active += row.active;
    day.idle += row.idle;
    days.set(row.day, day);
    if (row.app && row.active > 0) {
      apps.set(row.app, (apps.get(row.app) ?? 0) + row.active);
    }
    if (row.domain && row.active > 0) {
      domains.set(row.domain, (domains.get(row.domain) ?? 0) + row.active);
    }
  }

  const ranked = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));

  const dayList: { day: string; activeSeconds: number; idleSeconds: number }[] =
    [];
  for (
    let day = from;
    day <= to && dayList.length < 366;
    day = addDays(day, 1)
  ) {
    const d = days.get(day);
    dayList.push({
      day,
      activeSeconds: d?.active ?? 0,
      idleSeconds: d?.idle ?? 0,
    });
  }

  return {
    timeZone: company.timezone,
    activeSeconds,
    idleSeconds,
    apps: ranked(apps),
    domains: ranked(domains),
    days: dayList,
  };
}

export async function activitySpans(
  workspaceId: string,
  userId: string,
  day: string,
) {
  const company = await getCompanySettings(workspaceId);
  const { start, end } = zonedDayRange(day, company.timezone);
  return db
    .select({
      startedAt: activitySpanTable.startedAt,
      endedAt: activitySpanTable.endedAt,
      state: activitySpanTable.state,
      app: activitySpanTable.app,
      domain: activitySpanTable.domain,
    })
    .from(activitySpanTable)
    .where(
      and(
        eq(activitySpanTable.workspaceId, workspaceId),
        eq(activitySpanTable.userId, userId),
        gte(activitySpanTable.startedAt, start),
        lt(activitySpanTable.startedAt, end),
      ),
    )
    .orderBy(activitySpanTable.startedAt)
    .limit(2000);
}

// Keeps the tables from growing forever: details after N days, daily totals
// after M days (both company settings), and spent pairing codes.
export async function purgeOldActivity(now = new Date()) {
  const settings = await db
    .select({
      workspaceId: workspaceTable.id,
      detailDays: companySettingsTable.activityDetailDays,
      summaryDays: companySettingsTable.activitySummaryDays,
    })
    .from(workspaceTable)
    .leftJoin(
      companySettingsTable,
      eq(companySettingsTable.workspaceId, workspaceTable.id),
    );

  let spans = 0;
  let daily = 0;
  for (const s of settings) {
    const detailDays = s.detailDays ?? 90;
    const summaryDays = s.summaryDays ?? 365;
    const spanCutoff = new Date(now.getTime() - detailDays * 86_400_000);
    const dayCutoff = new Date(now.getTime() - summaryDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const removedSpans = await db
      .delete(activitySpanTable)
      .where(
        and(
          eq(activitySpanTable.workspaceId, s.workspaceId),
          lt(activitySpanTable.startedAt, spanCutoff),
        ),
      );
    const removedDaily = await db
      .delete(activityDailyTable)
      .where(
        and(
          eq(activityDailyTable.workspaceId, s.workspaceId),
          lt(activityDailyTable.day, dayCutoff),
        ),
      );
    spans += removedSpans.rowCount ?? 0;
    daily += removedDaily.rowCount ?? 0;
  }

  await db
    .delete(agentPairingCodeTable)
    .where(lt(agentPairingCodeTable.expiresAt, now));

  return { spans, daily };
}
