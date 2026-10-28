import { publishEvent } from "../../events";
import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import { listWorkspaceAudience } from "../../workspace/lifecycle/list-workspace-audience";
import { broadcastToUser } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockWorkspaceRow } from "../../workspace/lifecycle/lock-workspace-row";

async function restoreWorkspace(workspaceId: string, audit: AdminAuditRequest) {
  const userIds = await db.transaction(async (tx) => {
    const workspace = await lockWorkspaceRow(tx, workspaceId);
    if (!workspace.archivedAt) {
      throw new ApiError(409, {
        code: "WORKSPACE_NOT_ARCHIVED",
        message: "The workspace is not archived",
      });
    }

    await tx
      .update(schema.workspaceTable)
      .set({ archivedAt: null, archivedBy: null })
      .where(eq(schema.workspaceTable.id, workspaceId));
    await recordAdminAction(
      {
        ...audit,
        action: "workspace.restored",
        targetType: "workspace",
        targetId: workspace.id,
        targetLabel: workspace.name,
        metadata: {
          slug: workspace.slug,
          archivedAt: workspace.archivedAt.toISOString(),
        },
      },
      tx,
    );
    return listWorkspaceAudience(workspaceId, tx);
  });

  // Lets open clients show the workspace again without a reload.
  for (const userId of userIds) {
    broadcastToUser(userId, { type: "WORKSPACE_RESTORED", workspaceId });
  }

  await publishEvent("workspace.restored", { workspaceId });
  return { id: workspaceId, archivedAt: null };
}

export default restoreWorkspace;
