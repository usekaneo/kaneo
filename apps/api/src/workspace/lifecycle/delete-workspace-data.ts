import { publishEvent } from "../../events";
import { count, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import {
  findBillableWorkspaces,
  formatBillableWorkspacesMessage,
} from "../../billing/controllers/find-billable-workspaces";
import { ApiError } from "../../errors/api-error";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { listWorkspaceAudience } from "./list-workspace-audience";
import { listWorkspaceObjectKeys } from "./list-workspace-object-keys";
import { revokeWorkspaceAudience } from "./revoke-workspace-audience";
import type { AdminAuditRequest } from "../../admin/audit/admin-audit-request";
import { recordAdminAction } from "../../admin/audit/record-admin-action";
import { lockWorkspaceRow } from "./lock-workspace-row";

/**
 * Deletes a workspace the way the owner's "Delete workspace" does: the same
 * billing guard, cascade, storage cleanup, and realtime revocation, without
 * requiring the administrator to be a member.
 */
export async function deleteWorkspaceData(
  workspaceId: string,
  audit?: AdminAuditRequest,
) {
  const { audience, workspace } = await db.transaction(async (tx) => {
    const workspace = await lockWorkspaceRow(tx, workspaceId);

    const billable = await findBillableWorkspaces([workspaceId]);
    if (billable.length > 0) {
      throw new ApiError(409, {
        code: "WORKSPACE_HAS_ACTIVE_SUBSCRIPTION",
        message: formatBillableWorkspacesMessage(
          billable.map((entry) => entry.name),
        ),
      });
    }

    const audience = await listWorkspaceAudience(workspaceId, tx);
    const objectKeys = await listWorkspaceObjectKeys(workspaceId, tx);
    const [members] = await tx
      .select({ value: count() })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, workspaceId));
    const [projects] = await tx
      .select({ value: count() })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.workspaceId, workspaceId));

    // Queued in the same transaction, so objects are removed only if the
    // rows that reference them are.
    await queueStorageCleanup(tx, objectKeys);
    await tx
      .update(schema.sessionTable)
      .set({ activeOrganizationId: null, activeTeamId: null })
      .where(eq(schema.sessionTable.activeOrganizationId, workspaceId));
    await tx
      .delete(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspaceId));
    if (audit)
      await recordAdminAction(
        {
          ...audit,
          action: "workspace.deleted",
          targetType: "workspace",
          targetId: workspace.id,
          targetLabel: workspace.name,
          metadata: {
            slug: workspace.slug,
            memberCount: members?.value ?? 0,
            projectCount: projects?.value ?? 0,
            wasArchived: workspace.archivedAt !== null,
          },
        },
        tx,
      );
    return { audience, workspace };
  });

  await revokeWorkspaceAudience(audience, workspaceId);
  await publishEvent("workspace.deleted", { workspaceId });

  return workspace;
}
