import { and, desc, eq, gt } from "drizzle-orm";
import db from "../database";
import { sessionTable } from "../database/schema";
import { parseUserAgent } from "../utils/parse-user-agent";

/** A user's unexpired sessions, the caller's own first. Never includes tokens. */
export async function listActiveSessions(
  userId: string,
  currentSessionId: string | null,
) {
  const rows = await db
    .select({
      id: sessionTable.id,
      userAgent: sessionTable.userAgent,
      ipAddress: sessionTable.ipAddress,
      createdAt: sessionTable.createdAt,
      updatedAt: sessionTable.updatedAt,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.userId, userId),
        gt(sessionTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessionTable.updatedAt), desc(sessionTable.id));

  const sessions = rows.map((row) => {
    const device = parseUserAgent(row.userAgent);
    return {
      id: row.id,
      browser: device?.browser ?? null,
      os: device?.os ?? null,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      current: row.id === currentSessionId,
    };
  });
  return {
    sessions: [
      ...sessions.filter((session) => session.current),
      ...sessions.filter((session) => !session.current),
    ],
  };
}
