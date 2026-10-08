import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import type { MemberProjectAccess } from "./member-project-access-type";

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
