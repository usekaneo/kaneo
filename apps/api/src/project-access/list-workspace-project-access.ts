import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import type { MemberProjectAccess } from "./member-project-access-type";
import { projectAccessCondition } from "./project-access-condition";

export async function listWorkspaceProjectAccess(
  workspaceId: string,
  viewerId: string,
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
      .where(
        and(
          eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
          projectAccessCondition(
            viewerId,
            schema.workspaceMemberProjectTable.projectId,
          ),
        ),
      ),
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
