import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";

type ListWorkspacesInput = {
  search?: string;
  page: number;
  limit: number;
};

async function listWorkspaces({ search, page, limit }: ListWorkspacesInput) {
  const term = search?.trim() ?? "";
  const pattern = `%${escapeLikePattern(term)}%`;
  const where = term
    ? or(
        ilike(workspaceTable.name, pattern),
        ilike(workspaceTable.slug, pattern),
      )
    : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: workspaceTable.id,
        name: workspaceTable.name,
        slug: workspaceTable.slug,
        createdAt: workspaceTable.createdAt,
        memberCount: sql<number>`(select count(*)::int from ${workspaceUserTable} where ${workspaceUserTable.workspaceId} = ${workspaceTable.id})`,
        projectCount: sql<number>`(select count(*)::int from ${projectTable} where ${projectTable.workspaceId} = ${workspaceTable.id})`,
      })
      .from(workspaceTable)
      .where(where)
      .orderBy(desc(workspaceTable.createdAt), desc(workspaceTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(workspaceTable).where(where),
  ]);

  const owners =
    rows.length > 0
      ? await db
          .select({
            workspaceId: workspaceUserTable.workspaceId,
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
          })
          .from(workspaceUserTable)
          .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
          .where(
            and(
              inArray(
                workspaceUserTable.workspaceId,
                rows.map((row) => row.id),
              ),
              sql`'owner' = any(string_to_array(${workspaceUserTable.role}, ','))`,
            ),
          )
      : [];

  return {
    workspaces: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      owners: owners
        .filter((owner) => owner.workspaceId === row.id)
        .map(({ id, name, email }) => ({ id, name, email })),
    })),
    total: totalRow?.value ?? 0,
  };
}

export default listWorkspaces;
