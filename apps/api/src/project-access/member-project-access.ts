import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import type { ProjectAccessMode } from "./project-access-mode";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MemberProjectAccess = {
  userId: string;
  projectAccess: ProjectAccessMode;
  projectIds: string[];
};

export async function listWorkspaceProjectAccess(
  workspaceId: string,
): Promise<MemberProjectAccess[]> {
  const [rules, grants] = await Promise.all([
    db
      .select({
        userId: schema.workspaceMemberAccessTable.userId,
        projectAccess: schema.workspaceMemberAccessTable.projectAccess,
      })
      .from(schema.workspaceMemberAccessTable)
      .where(eq(schema.workspaceMemberAccessTable.workspaceId, workspaceId)),
    db
      .select({
        userId: schema.workspaceMemberProjectTable.userId,
        projectId: schema.workspaceMemberProjectTable.projectId,
      })
      .from(schema.workspaceMemberProjectTable)
      .where(eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId)),
  ]);

  return rules
    .filter((rule) => rule.projectAccess !== "all")
    .map((rule) => ({
      userId: rule.userId,
      projectAccess: "selected" as const,
      projectIds: grants
        .filter((grant) => grant.userId === rule.userId)
        .map((grant) => grant.projectId),
    }));
}

export async function getMemberProjectAccess(
  workspaceId: string,
  userId: string,
  database: DbOrTx = db,
): Promise<MemberProjectAccess> {
  const [rule] = await database
    .select({ projectAccess: schema.workspaceMemberAccessTable.projectAccess })
    .from(schema.workspaceMemberAccessTable)
    .where(
      and(
        eq(schema.workspaceMemberAccessTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberAccessTable.userId, userId),
      ),
    )
    .limit(1);

  if (!rule || rule.projectAccess === "all") {
    return { userId, projectAccess: "all", projectIds: [] };
  }

  const grants = await database
    .select({ projectId: schema.workspaceMemberProjectTable.projectId })
    .from(schema.workspaceMemberProjectTable)
    .where(
      and(
        eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberProjectTable.userId, userId),
      ),
    );

  return {
    userId,
    projectAccess: "selected",
    projectIds: grants.map((grant) => grant.projectId),
  };
}

export async function findWorkspaceProjectIds(
  workspaceId: string,
  projectIds: readonly string[],
  database: DbOrTx = db,
): Promise<string[]> {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) return [];

  const rows = await database
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        inArray(schema.projectTable.id, ids),
      ),
    );

  return rows.map((row) => row.id);
}

export async function replaceMemberProjectAccess(
  database: DbOrTx,
  access: {
    workspaceId: string;
    userId: string;
    projectAccess: ProjectAccessMode;
    projectIds: readonly string[];
  },
): Promise<void> {
  const { workspaceId, userId, projectAccess } = access;

  if (projectAccess === "all") {
    await clearMemberProjectAccess(workspaceId, userId, database);
    return;
  }

  await database
    .insert(schema.workspaceMemberAccessTable)
    .values({ workspaceId, userId, projectAccess })
    .onConflictDoUpdate({
      target: [
        schema.workspaceMemberAccessTable.workspaceId,
        schema.workspaceMemberAccessTable.userId,
      ],
      set: { projectAccess, updatedAt: new Date() },
    });

  await database
    .delete(schema.workspaceMemberProjectTable)
    .where(
      and(
        eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberProjectTable.userId, userId),
      ),
    );

  const projectIds = await findWorkspaceProjectIds(
    workspaceId,
    access.projectIds,
    database,
  );
  if (projectIds.length === 0) return;

  await database
    .insert(schema.workspaceMemberProjectTable)
    .values(projectIds.map((projectId) => ({ workspaceId, userId, projectId })))
    .onConflictDoNothing();
}

export async function clearMemberProjectAccess(
  workspaceId: string,
  userId: string,
  database: DbOrTx = db,
): Promise<void> {
  await database
    .delete(schema.workspaceMemberProjectTable)
    .where(
      and(
        eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberProjectTable.userId, userId),
      ),
    );
  await database
    .delete(schema.workspaceMemberAccessTable)
    .where(
      and(
        eq(schema.workspaceMemberAccessTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberAccessTable.userId, userId),
      ),
    );
}

export async function grantProjectToRestrictedMember(
  database: DbOrTx,
  grant: { workspaceId: string; userId: string; projectId: string },
): Promise<void> {
  const access = await getMemberProjectAccess(
    grant.workspaceId,
    grant.userId,
    database,
  );
  if (access.projectAccess === "all") return;

  await database
    .insert(schema.workspaceMemberProjectTable)
    .values(grant)
    .onConflictDoNothing();
}
