import { and, asc, count, eq, sql } from "drizzle-orm";
import db, { schema } from "../database";

export const nonAnonymousUser = sql`${schema.userTable.isAnonymous} IS NOT TRUE`;

export async function hasRegisteredUsers(): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.userTable)
    .where(nonAnonymousUser);
  return (row?.value ?? 0) > 0;
}

export async function promoteInitialAdministrator(
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(2026)`);
    const [admin] = await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(and(nonAnonymousUser, eq(schema.userTable.role, "admin")))
      .limit(1);
    if (admin) return;

    // Elect the earliest registered user, not the only row: concurrent first
    // signups may both be inserted before either after-hook gets this lock.
    // Existing non-admin accounts remain ineligible for promotion by a later
    // signup. Anonymous rows never consume the initial-admin slot.
    const [first] = await tx
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(nonAnonymousUser)
      .orderBy(asc(schema.userTable.createdAt), asc(schema.userTable.id))
      .limit(1);
    if (first?.id !== userId) return;
    await tx
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, userId));
  });
}
