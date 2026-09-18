import { and, eq, gt, isNull } from "drizzle-orm";
import db from "../database";
import { agentDeviceTable, attendanceSessionTable } from "../database/schema";

// The agent heartbeats every minute; two missed beats means offline.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** People with an open attendance session in the workspace. */
export async function clockedInUserIds(workspaceId: string) {
  const rows = await db
    .select({ userId: attendanceSessionTable.userId })
    .from(attendanceSessionTable)
    .where(
      and(
        eq(attendanceSessionTable.workspaceId, workspaceId),
        isNull(attendanceSessionTable.clockOut),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

/** People whose desktop app reported in recently. Presence, not work. */
export async function onlineUserIds(workspaceId: string, now = new Date()) {
  const rows = await db
    .selectDistinct({ userId: agentDeviceTable.userId })
    .from(agentDeviceTable)
    .where(
      and(
        eq(agentDeviceTable.workspaceId, workspaceId),
        isNull(agentDeviceTable.revokedAt),
        gt(
          agentDeviceTable.lastSeenAt,
          new Date(now.getTime() - ONLINE_WINDOW_MS),
        ),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}
