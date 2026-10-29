import { and, eq, ne } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";

type Which = { sessionId: string } | { exceptSessionId: string | null };

/**
 * Delete one or all of a user's sessions and return the deleted ids. Locks the
 * user row first, the same order the auth adapter and MCP redemption use.
 */
export async function deleteUserSessions(
  tx: DbOrTx,
  userId: string,
  which: Which,
) {
  await tx
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .for("update");

  const session = schema.sessionTable;
  const deleted = await tx
    .delete(session)
    .where(
      and(
        eq(session.userId, userId),
        "sessionId" in which
          ? eq(session.id, which.sessionId)
          : which.exceptSessionId
            ? ne(session.id, which.exceptSessionId)
            : undefined,
      ),
    )
    .returning({ id: session.id });
  return deleted.map((row) => row.id);
}
