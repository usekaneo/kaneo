import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { assertStoredOwnerRoleSafe } from "./assert-stored-owner-role-safe";

export async function assertNativeOwnerRoleSafe(
  userId: string,
  workspaceId: string,
) {
  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);
  // The provider trims the actor's owner token on invitation and removal,
  // unlike its other authorization checks. Quarantine those legacy grants
  // without changing stored membership or granting canonical ownership.
  if (member) assertStoredOwnerRoleSafe(member.role);
}
