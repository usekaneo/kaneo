import { publishEvent } from "../../events";
import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import { listWorkspaceAudience } from "../../workspace/lifecycle/list-workspace-audience";
import { revokeWorkspaceAudience } from "../../workspace/lifecycle/revoke-workspace-audience";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockWorkspaceRow } from "../../workspace/lifecycle/lock-workspace-row";

async function archiveWorkspace(workspaceId: string, audit: AdminAuditRequest) {
  const archivedAt = new Date();
  const userIds = await db.transaction(async (tx) => {
    const workspace = await lockWorkspaceRow(tx, workspaceId);
    if (workspace.archivedAt) {
      throw new ApiError(409, {
        code: "WORKSPACE_ALREADY_ARCHIVED",
        message: "The workspace is already archived",
      });
    }

    await tx
      .update(schema.workspaceTable)
      .set({ archivedAt, archivedBy: audit.actorUserId })
      .where(eq(schema.workspaceTable.id, workspaceId));
    await recordAdminAction(
      {
        ...audit,
        action: "workspace.archived",
        targetType: "workspace",
        targetId: workspace.id,
        targetLabel: workspace.name,
        metadata: { slug: workspace.slug },
      },
      tx,
    );
    return listWorkspaceAudience(workspaceId, tx);
  });

  // Open boards and the user socket learn the workspace is gone right away.
  await revokeWorkspaceAudience(userIds, workspaceId, "archived");

  await publishEvent("workspace.archived", { workspaceId }).catch((error) => {
    console.error("Failed to publish workspace archived event:", error);
  });
  return { id: workspaceId, archivedAt: archivedAt.toISOString() };
}

export default archiveWorkspace;
