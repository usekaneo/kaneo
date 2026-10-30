import { eq } from "drizzle-orm";
import { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";
import type { AdminAuditRequest } from "./admin-audit-request";
import { recordAdminAction } from "./record-admin-action";

type WorkspaceMemberAction =
  | "workspace.member_added"
  | "workspace.member_removed"
  | "workspace.member_role_changed"
  | "workspace.owner_transferred";

/** Record a membership change against the workspace, naming the member. */
export async function recordWorkspaceMemberAction(
  database: DbOrTx,
  audit: AdminAuditRequest,
  entry: {
    action: WorkspaceMemberAction;
    workspaceId: string;
    userId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const [names] = await database
    .select({
      workspaceName: schema.workspaceTable.name,
      userName: schema.userTable.name,
      userEmail: schema.userTable.email,
    })
    .from(schema.workspaceTable)
    .leftJoin(schema.userTable, eq(schema.userTable.id, entry.userId))
    .where(eq(schema.workspaceTable.id, entry.workspaceId))
    .limit(1);

  await recordAdminAction(
    {
      ...audit,
      action: entry.action,
      targetType: "workspace",
      targetId: entry.workspaceId,
      targetLabel: names?.workspaceName ?? null,
      metadata: {
        member: {
          id: entry.userId,
          name: names?.userName ?? null,
          email: names?.userEmail ?? null,
        },
        ...entry.metadata,
      },
    },
    database,
  );
}
