import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../database";
import {
  projectTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";

const archiver = alias(userTable, "archiver");

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
        archivedAt: workspaceTable.archivedAt,
        archiverId: archiver.id,
        archiverName: archiver.name,
        archiverEmail: archiver.email,
      })
      .from(workspaceTable)
      .leftJoin(archiver, eq(archiver.id, workspaceTable.archivedBy))
      .where(where)
      .orderBy(desc(workspaceTable.createdAt), desc(workspaceTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(workspaceTable).where(where),
  ]);

  if (rows.length === 0) {
    return { workspaces: [], total: totalRow?.value ?? 0 };
  }

  const workspaceIds = rows.map((row) => row.id);
  const [owners, memberCounts, projectCounts] = await Promise.all([
    db
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
          inArray(workspaceUserTable.workspaceId, workspaceIds),
          sql`'owner' = any(string_to_array(${workspaceUserTable.role}, ','))`,
        ),
      ),
    db
      .select({
        workspaceId: workspaceUserTable.workspaceId,
        value: count(),
      })
      .from(workspaceUserTable)
      .where(inArray(workspaceUserTable.workspaceId, workspaceIds))
      .groupBy(workspaceUserTable.workspaceId),
    db
      .select({ workspaceId: projectTable.workspaceId, value: count() })
      .from(projectTable)
      .where(inArray(projectTable.workspaceId, workspaceIds))
      .groupBy(projectTable.workspaceId),
  ]);

  const members = new Map(
    memberCounts.map((row) => [row.workspaceId, row.value]),
  );
  const projects = new Map(
    projectCounts.map((row) => [row.workspaceId, row.value]),
  );

  return {
    workspaces: rows.map(
      ({ archiverId, archiverName, archiverEmail, ...row }) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        archivedAt: row.archivedAt?.toISOString() ?? null,
        archivedBy:
          archiverId && archiverName && archiverEmail
            ? { id: archiverId, name: archiverName, email: archiverEmail }
            : null,
        memberCount: members.get(row.id) ?? 0,
        projectCount: projects.get(row.id) ?? 0,
        owners: owners
          .filter((owner) => owner.workspaceId === row.id)
          .map(({ id, name, email }) => ({ id, name, email })),
      }),
    ),
    total: totalRow?.value ?? 0,
  };
}

export default listWorkspaces;
