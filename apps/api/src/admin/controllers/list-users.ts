import { and, count, desc, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import db from "../../database";
import { activityTable, sessionTable, userTable } from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";

type ListUsersInput = {
  search?: string;
  page: number;
  limit: number;
};

export async function listUsers({ search, page, limit }: ListUsersInput) {
  const term = search?.trim() ?? "";
  const pattern = `%${escapeLikePattern(term)}%`;
  const where = term
    ? or(ilike(userTable.name, pattern), ilike(userTable.email, pattern))
    : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        image: userTable.image,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
        role: userTable.role,
        banned: userTable.banned,
        banReason: userTable.banReason,
        banExpires: userTable.banExpires,
      })
      .from(userTable)
      .where(where)
      .orderBy(desc(userTable.createdAt), desc(userTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(userTable).where(where),
  ]);

  const lastUsed = new Map<string, Date>();
  if (rows.length > 0) {
    const userIds = rows.map((row) => row.id);
    const [sessions, activities] = await Promise.all([
      db
        .select({
          userId: sessionTable.userId,
          lastUsedAt:
            sql<Date | null>`max(greatest(${sessionTable.createdAt}, ${sessionTable.updatedAt}))`.mapWith(
              sessionTable.createdAt,
            ),
        })
        .from(sessionTable)
        .where(
          and(
            inArray(sessionTable.userId, userIds),
            isNull(sessionTable.impersonatedBy),
          ),
        )
        .groupBy(sessionTable.userId),
      db
        .select({
          userId: activityTable.userId,
          lastUsedAt: sql<Date | null>`max(${activityTable.createdAt})`.mapWith(
            activityTable.createdAt,
          ),
        })
        .from(activityTable)
        .where(inArray(activityTable.userId, userIds))
        .groupBy(activityTable.userId),
    ]);
    for (const row of [...sessions, ...activities]) {
      if (!row.userId || !row.lastUsedAt) continue;
      const previous = lastUsed.get(row.userId);
      if (!previous || row.lastUsedAt > previous)
        lastUsed.set(row.userId, row.lastUsedAt);
    }
  }

  return {
    users: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastUsedAt: lastUsed.get(row.id)?.toISOString() ?? null,
      banned: row.banned ?? false,
      banExpires: row.banExpires ? row.banExpires.toISOString() : null,
    })),
    total: totalRow?.value ?? 0,
  };
}

export default listUsers;
