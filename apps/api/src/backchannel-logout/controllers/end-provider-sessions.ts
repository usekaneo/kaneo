import { createHash } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import db, { schema } from "../../database";
import { revokeUserConnections } from "../../ws";
import { LogoutTokenRejected } from "../errors";
import {
  CLOCK_SKEW_SECONDS,
  type LogoutTokenClaims,
  MAX_LOGOUT_TOKEN_AGE_SECONDS,
} from "../verify-logout-token";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function claimLogoutToken(
  tx: Transaction,
  { iss, jti, iat }: LogoutTokenClaims,
) {
  const identifier = `backchannel-logout:${iss}:${jti}`;
  const [claimed] = await tx
    .insert(schema.verificationTable)
    .values({
      id: createHash("sha256").update(identifier).digest("base64url"),
      identifier,
      value: "used",
      expiresAt: new Date(
        (iat + MAX_LOGOUT_TOKEN_AGE_SECONDS + CLOCK_SKEW_SECONDS) * 1000,
      ),
    })
    .onConflictDoNothing({ target: schema.verificationTable.id })
    .returning({ id: schema.verificationTable.id });
  return Boolean(claimed);
}

async function findCustomAccountUsers(tx: Transaction, accountId: string) {
  const accounts = await tx
    .select({ userId: schema.accountTable.userId })
    .from(schema.accountTable)
    .where(
      and(
        eq(schema.accountTable.providerId, "custom"),
        eq(schema.accountTable.accountId, accountId),
      ),
    );
  return [...new Set(accounts.map((account) => account.userId))];
}

async function hasActiveSession(userId: string) {
  const [session] = await db
    .select({ id: schema.sessionTable.id })
    .from(schema.sessionTable)
    .where(
      and(
        eq(schema.sessionTable.userId, userId),
        gt(schema.sessionTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(session);
}

async function closeSignedOutConnections(userIds: string[]) {
  for (const userId of userIds) {
    // Revoked sockets sign out every tab, so wait until no session is left.
    if (!(await hasActiveSession(userId))) await revokeUserConnections(userId);
  }
}

export async function endProviderSessions(claims: LogoutTokenClaims) {
  const { sid, sub } = claims;
  if (sid === undefined && sub === undefined) {
    throw new Error("A logout needs a session ID or a subject");
  }

  const signedOutUserIds = await db.transaction(async (tx) => {
    if (!(await claimLogoutToken(tx, claims))) {
      throw new LogoutTokenRejected("the logout token was used before");
    }
    const userIds =
      sub === undefined ? undefined : await findCustomAccountUsers(tx, sub);
    if (userIds?.length === 0) return [];
    const ended = await tx
      .delete(schema.sessionTable)
      .where(
        and(
          sid === undefined ? undefined : eq(schema.sessionTable.oidcSid, sid),
          userIds === undefined
            ? undefined
            : inArray(schema.sessionTable.userId, userIds),
        ),
      )
      .returning({ userId: schema.sessionTable.userId });
    return [...new Set(ended.map((session) => session.userId))];
  });

  await closeSignedOutConnections(signedOutUserIds).catch((error) => {
    console.error(
      "Closing realtime connections after a back-channel logout failed:",
      error,
    );
  });
}
