import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import db from "../../database";
import { sessionTable, userTable } from "../../database/schema";

export async function validateSessionToken(token: string) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const sessions = await db
    .select({ user: userTable, session: sessionTable })
    .from(sessionTable)
    .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(eq(sessionTable.id, sessionId));

  if (sessions.length < 1 || !sessions[0]) {
    return { session: null, user: null };
  }

  const { user, session } = sessions[0];

  const isSessionExpired = Date.now() >= session.expiresAt.getTime();

  if (isSessionExpired) {
    await db.delete(sessionTable).where(eq(sessionTable.id, session.id));
    return { session: null, user: null };
  }

  const isSessionHalfWayExpired =
    Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15;

  if (isSessionHalfWayExpired) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await db
      .update(sessionTable)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(sessionTable.id, session.id));
  }

  return { session, user };
}
