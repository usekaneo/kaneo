import { sql } from "drizzle-orm";
import { userTable } from "../../database/schema";

/**
 * Columns of an admin directory row. Last activity and sign-in methods are
 * correlated subqueries on indexed user ids, evaluated only for the page.
 * Columns are qualified by hand: Drizzle leaves them bare in one-table selects.
 * Timestamps are stored as UTC without a zone; say so, or the driver reads
 * them in the server's local time.
 */
export const adminUserColumns = {
  id: userTable.id,
  name: userTable.name,
  email: userTable.email,
  emailVerified: userTable.emailVerified,
  isAnonymous: userTable.isAnonymous,
  image: userTable.image,
  createdAt: userTable.createdAt,
  updatedAt: userTable.updatedAt,
  role: userTable.role,
  banned: userTable.banned,
  banReason: userTable.banReason,
  banExpires: userTable.banExpires,
  lastActiveAt: sql<Date | string | null>`(
    SELECT max(s."updated_at") AT TIME ZONE 'UTC'
    FROM "session" s WHERE s."user_id" = "user"."id"
  )`,
  signInMethods: sql<string[]>`(
    SELECT coalesce(array_agg(DISTINCT a."provider_id"), '{}')
    FROM "account" a WHERE a."user_id" = "user"."id"
  )`,
};

type AdminUserRow = {
  [Key in keyof typeof adminUserColumns]: Key extends "lastActiveAt"
    ? Date | string | null
    : Key extends "signInMethods"
      ? string[]
      : (typeof userTable.$inferSelect)[Key &
          keyof typeof userTable.$inferSelect];
};

const iso = (value: Date | string) => new Date(value).toISOString();

export function toAdminUser(row: AdminUserRow) {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    banned: row.banned ?? false,
    isAnonymous: row.isAnonymous ?? false,
    banExpires: row.banExpires ? iso(row.banExpires) : null,
    lastActiveAt: row.lastActiveAt ? iso(row.lastActiveAt) : null,
    signInMethods: [...row.signInMethods].sort(),
  };
}
