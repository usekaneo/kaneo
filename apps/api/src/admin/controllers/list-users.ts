import { and, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";
import { instanceAdminRoleSql } from "../../utils/instance-admin-role";
import { notBannedCondition } from "../../utils/user-ban";
import { adminUserColumns, toAdminUser } from "../users/admin-user-columns";

type ListUsersInput = {
  search?: string;
  status?: "active" | "deactivated";
  role?: string;
  emailVerified?: boolean;
  page: number;
  limit: number;
};

// Qualified by hand: Drizzle leaves columns bare in one-table selects.
const userRoles = sql`string_to_array("user"."role", ',')`;

/** `user` means no admin or custom role: the roles that grant nothing. */
function roleCondition(role: string, isAdmin: SQL) {
  if (role === "admin") return isAdmin;
  if (role !== "user") return sql`${role} = ANY(${userRoles})`;
  return sql`NOT ${isAdmin} AND NOT EXISTS (
    SELECT 1 FROM "instance_role" r WHERE r."name" = ANY(${userRoles})
  )`;
}

function filters({ search, status, role, emailVerified }: ListUsersInput) {
  const term = search?.trim() ?? "";
  const pattern = `%${escapeLikePattern(term)}%`;
  const active = notBannedCondition();
  const isAdmin = sql`coalesce(${instanceAdminRoleSql(userTable.role)}, false)`;
  return and(
    term
      ? or(ilike(userTable.name, pattern), ilike(userTable.email, pattern))
      : undefined,
    status === undefined
      ? undefined
      : status === "deactivated"
        ? sql`NOT (${active})`
        : active,
    role === undefined ? undefined : roleCondition(role, isAdmin),
    emailVerified === undefined
      ? undefined
      : eq(userTable.emailVerified, emailVerified),
  );
}

export async function listUsers(input: ListUsersInput) {
  const where = filters(input);
  const { page, limit } = input;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(adminUserColumns)
      .from(userTable)
      .where(where)
      .orderBy(desc(userTable.createdAt), desc(userTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(userTable).where(where),
  ]);

  return {
    users: rows.map(toAdminUser),
    total: totalRow?.value ?? 0,
  };
}

export default listUsers;
