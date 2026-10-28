import { and, eq } from "drizzle-orm";
import { schema } from "../database";
import { clearMemberProjectAccess } from "./clear-member-project-access";
import type { DbOrTx } from "./db-or-tx";
import { findWorkspaceProjectIds } from "./find-workspace-project-ids";
import type { ProjectAccessMode } from "./project-access-mode";

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
